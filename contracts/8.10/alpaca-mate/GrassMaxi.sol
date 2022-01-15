// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";

import "../interfaces/IGrassHouse.sol";
import "../interfaces/IxALPACA.sol";
import "../SafeToken.sol";
import "./apis/pancakeV2/IPancakeRouter02.sol";

/// @title GrassMaxi
/// @notice GrassMaxi is an auto-compounding xALPACA yield aggregator. Maximum APY by swapping all the reward tokens to ALPACAs and lock back to xALPACA vault weekly.
contract GrassMaxi is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using SafeToken for address;

    event LogDeposit(address user, uint256 amount, uint256 share);
    event LogReinvest(uint256 reward, uint256 bounty);
    event LogWithdraw(address user, uint256 amount);
    event LogCollectBounty(uint256 bountyAmount);

    /// @dev Constants
    uint256 public constant WEEK = 7 days;
    /// @dev MAX_LOCK 53 weeks - 1 seconds
    uint256 public constant MAX_LOCK = (53 * WEEK) - 1;

    /// @dev xALPACA address
    address public xALPACA;
    /// @dev ALPACA token address
    address public ALPACA;
    /// @dev PancakeRouter v2
    address public pcsRouterV2;
    /// @dev WBNB
    address public wNative;

    /// @dev reinvest bounty percent in bps
    uint256 public treasuryBountyBps;
    /// @dev bounty amount
    uint256 public bountyAmount;

    /// @dev total alpaca share of all users
    uint256 public totalShare;
    /// @dev userAddress => userShare
    mapping(address => uint256) public userShares;

    function initialize(
        address _xALPACA,
        address _ALPACA,
        address _pcsRouterV2,
        address _wNative,
        uint256 _treasuryBountyBps
    ) external initializer {
        OwnableUpgradeable.__Ownable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        xALPACA = _xALPACA;
        ALPACA = _ALPACA;
        pcsRouterV2 = _pcsRouterV2;
        wNative = _wNative;
        treasuryBountyBps = _treasuryBountyBps;
        ALPACA.safeApprove(xALPACA, type(uint256).max);
    }

    modifier lockCreated() {
        require(totalLockedAmount() > 0, "lock not created yet");
        _;
    }

    /// @notice creates a lock for this vault. should be called before any deposits. Require whitelisted by xALPACA.
    function createLock() external onlyOwner {
        require(totalLockedAmount() == 0, "already has a lock");
        // createLock requires amount > 0
        ALPACA.safeTransferFrom(msg.sender, address(this), 1);
        IxALPACA(xALPACA).createLock(1, block.timestamp + MAX_LOCK);
    }

    /// @notice claim and swap all rewards to ALPACA and reinvest to xALPACA, will increase total amount of this vault.
    function claimAndReinvest(address[] calldata _grassHouses) external lockCreated {
        uint256 alpacaBalanceBefore = ALPACA.myBalance();
        // claim and swap reward token to ALPACA
        for (uint256 i = 0; i < _grassHouses.length; i++) {
            IGrassHouse(_grassHouses[i]).claim(address(this));
            _swapRewardToken(IGrassHouse(_grassHouses[i]).rewardToken());
        }
        uint256 alpacaBalanceAfter = ALPACA.myBalance();
        uint256 earned = alpacaBalanceAfter - alpacaBalanceBefore;
        if (earned > 0) {
            uint256 bounty = earned * treasuryBountyBps / 10000;
            bountyAmount += bounty;
            // reinvest earned - bounty
            IxALPACA(xALPACA).increaseLockAmount(earned - bounty);
            emit LogReinvest(earned, bounty);
        }
    }

    /// @notice deposit _amount of ALPACA token to vault. Letting vault to increase the APY.
    function deposit(uint256 _amount) external lockCreated nonReentrant {
        require(_amount > 0, "bad _amount");
        ALPACA.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 share = amountToShare(_amount);
        totalShare += share;
        userShares[msg.sender] += share;
        IxALPACA(xALPACA).increaseLockAmount(_amount);
        emit LogDeposit(msg.sender, _amount, share);
    }

    function withdraw() external nonReentrant {
        if (totalLockedAmount() > 0) {
            // success only when lock is expired or xALPACA breaker is on
            IxALPACA(xALPACA).withdraw();
        }
        uint256 userShare = userShares[msg.sender];
        userShares[msg.sender] = 0;
        uint256 userAmount = _shareToAmount(userShare, ALPACA.myBalance() - bountyAmount);
        ALPACA.safeTransfer(msg.sender, userAmount);
        emit LogWithdraw(msg.sender, userAmount);
    }

    /// @dev Return the ALPACA balance amount value given the share.
    /// @param share The share to be converted.
    function shareToAmount(uint256 share) public view returns (uint256) {
        return _shareToAmount(share, totalLockedAmount());
    }

    /// @dev Return the share for the given deposit ALPACA amount.
    /// @param amount The balance to be converted.
    function amountToShare(uint256 amount) public view returns (uint256) {
        if (totalShare == 0) return amount;
        // When there's no share, 1 share = 1 amount.
        return amount * totalShare / totalLockedAmount();
    }

    /// @dev Return the total locked amount of this vault
    function totalLockedAmount() public view returns (uint256) {
        return SafeCastUpgradeable.toUint256(IxALPACA(xALPACA).locks(address(this)).amount);
    }

    /// @dev helper function to swap token
    function _swapRewardToken(address rewardToken) internal {
        // no need to swap ALPACA token
        if (rewardToken != ALPACA) {
            uint256 rewardBalance = rewardToken.myBalance();
            if (rewardBalance > 0) {
                rewardToken.safeApprove(pcsRouterV2, rewardBalance);
                address[] memory path = new address[](3);
                path[0] = rewardToken;
                path[1] = wNative;
                path[2] = ALPACA;
                IPancakeRouter02(pcsRouterV2).swapExactTokensForTokens(rewardBalance, 0, path, address(this), block.timestamp);
                rewardToken.safeApprove(pcsRouterV2, 0);
            }
        }
    }

    /// @dev Return the ALPACA balance amount value given the share and total amount
    /// @param share The share to be converted.
    /// @param totalAmount The total amount, can be lockedAmount or balance of this vault
    function _shareToAmount(uint256 share, uint256 totalAmount) internal view returns (uint256) {
        if (totalShare == 0) return share;
        // When there's no share, 1 share = 1 amount.
        return share * totalAmount / totalShare;
    }

    // owner functions

    /// @notice owner collects vault bounty
    function collectBounty(address _to) external onlyOwner {
        uint256 transferAmount = bountyAmount;
        bountyAmount = 0;
        ALPACA.safeTransfer(_to, transferAmount);
        emit LogCollectBounty(transferAmount);
    }

    /// @notice in-case anyone transfer tokens into by mistake
    function withdrawToken(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_token != ALPACA, "bad _token");
        _token.safeTransfer(_to, _amount);
    }

}
