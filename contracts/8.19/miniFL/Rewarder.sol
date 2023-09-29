// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { SafeCastUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";

import { IMiniFL } from "./interfaces/IMiniFL.sol";
import { IRewarder } from "./interfaces/IRewarder.sol";

contract Rewarder is IRewarder, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  using SafeCastUpgradeable for uint256;
  using SafeCastUpgradeable for uint128;
  using SafeCastUpgradeable for int256;
  using SafeERC20Upgradeable for IERC20Upgradeable;

  address public rewardToken;

  struct UserInfo {
    uint256 amount;
    int256 rewardDebt;
  }

  struct PoolInfo {
    uint128 accRewardPerShare;
    uint64 lastRewardTime;
  }

  PoolInfo public poolInfo;
  uint256[] public poolIds;

  mapping(address => UserInfo) public userInfo;
  uint256 public rewardPerSecond;
  uint256 private constant ACC_REWARD_PRECISION = 1e12;

  address public miniFL;
  string public name;

  uint256 public maxRewardPerSecond;

  event LogOnDeposit(address indexed _user, uint256 _amount);
  event LogOnWithdraw(address indexed _user, uint256 _amount);
  event LogHarvest(address indexed _user, uint256 _amount);
  event LogUpdatePool(uint64 _lastRewardTime, uint256 _stakedBalance, uint256 _accRewardPerShare);
  event LogRewardPerSecond(uint256 _newRewardPerSecond);
  event LogSetName(string _name);
  event LogSetMaxRewardPerSecond(uint256 _newMaxRewardPerSecond);

  /// @dev allow only MiniFL
  modifier onlyMiniFL() {
    if (msg.sender != miniFL) revert Rewarder1_NotFL();
    _;
  }

  constructor() {
    _disableInitializers();
  }

  function initialize(
    string calldata _name,
    address _miniFL,
    address _rewardToken,
    uint256 _maxRewardPerSecond
  ) external initializer {
    OwnableUpgradeable.__Ownable_init();
    ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

    // sanity check
    IERC20Upgradeable(_rewardToken).totalSupply();
    IMiniFL(_miniFL).stakingReserve();

    name = _name;
    miniFL = _miniFL;
    rewardToken = _rewardToken;
    maxRewardPerSecond = _maxRewardPerSecond;
  }

  /// @notice Hook deposit action from MiniFL.
  /// @param _user The beneficary address of the deposit.
  /// @param _newAmount new staking amount from MiniFL.
  function onDeposit(address _user, uint256 _newAmount) external override onlyMiniFL {
    PoolInfo memory pool = _updatePool();
    UserInfo storage user = userInfo[_user];

    // calculate new staked amount
    // example: if user deposit another 500 shares
    //  - user.amount  = 100 => from previous deposit
    //  - _newAmount   = 600 => updated staking amount from MiniFL
    //  _amount = _newAmount - user.amount = 600 - 100 = 500
    uint256 _amount = _newAmount - user.amount;

    user.amount = _newAmount;
    // update user rewardDebt to separate new deposit share amount from pending reward in the pool
    // example:
    //  - accAlpacaPerShare    = 250
    //  - _receivedAmount      = 100
    //  - pendingAlpacaReward  = 25,000
    //  rewardDebt = oldRewardDebt + (_receivedAmount * accAlpacaPerShare)= 0 + (100 * 250) = 25,000
    //  This means newly deposit share does not eligible for 25,000 pending rewards
    user.rewardDebt = user.rewardDebt + ((_amount * pool.accRewardPerShare) / ACC_REWARD_PRECISION).toInt256();

    emit LogOnDeposit(_user, _amount);
  }

  /// @notice Hook Withdraw action from MiniFL.

  /// @param _user Withdraw from who?
  /// @param _newAmount new staking amount from MiniFL.
  function onWithdraw(address _user, uint256 _newAmount) external override onlyMiniFL {
    PoolInfo memory pool = _updatePool();
    UserInfo storage user = userInfo[_user];

    uint256 _currentAmount = user.amount;
    if (_currentAmount >= _newAmount) {
      // Handling normal case; When onDeposit call before onWithdraw
      uint256 _withdrawAmount;
      unchecked {
        _withdrawAmount = _currentAmount - _newAmount;
      }

      // update reward debt
      // example:
      //  - accAlpacaPerShare    = 300
      //  - _amountToWithdraw    = 100
      //  - oldRewardDebt        = 25,000
      //  - pendingAlpacaReward  = 35,000
      //  rewardDebt = oldRewardDebt - (_amountToWithdraw * accAlpacaPerShare) = 25,000 - (100 * 300) = -5000
      //  This means withdrawn share is eligible for previous pending reward in the pool = 5000
      user.rewardDebt =
        user.rewardDebt -
        (((_withdrawAmount * pool.accRewardPerShare) / ACC_REWARD_PRECISION)).toInt256();
      user.amount = _newAmount;

      emit LogOnWithdraw(_user, _withdrawAmount);
    } else {
      // Handling when rewarder1 getting set after the pool is live
      // if user.amount < _newAmount, then it is first deposit.
      user.amount = _newAmount;
      user.rewardDebt = user.rewardDebt + ((_newAmount * pool.accRewardPerShare) / ACC_REWARD_PRECISION).toInt256();

      emit LogOnDeposit(_user, _newAmount);
    }
  }

  /// @notice Hook Harvest action from MiniFL.
  /// @param _user The beneficary address.
  function onHarvest(address _user) external override onlyMiniFL {
    PoolInfo memory pool = _updatePool();
    UserInfo storage user = userInfo[_user];

    // example:
    //  - totalAmount         = 100
    //  - accAlpacaPerShare   = 250
    //  - rewardDebt          = 0
    //  accumulatedAlpaca     = totalAmount * accAlpacaPerShare = 100 * 250 = 25,000
    //  _pendingAlpaca         = accumulatedAlpaca - rewardDebt = 25,000 - 0 = 25,000
    //   Meaning user eligible for 25,000 rewards in this harvest
    int256 _accumulatedRewards = ((user.amount * pool.accRewardPerShare) / ACC_REWARD_PRECISION).toInt256();
    uint256 _pendingRewards = (_accumulatedRewards - user.rewardDebt).toUint256();

    user.rewardDebt = _accumulatedRewards;

    if (_pendingRewards != 0) {
      IERC20Upgradeable(rewardToken).safeTransfer(_user, _pendingRewards);
    }

    emit LogHarvest(_user, _pendingRewards);
  }

  /// @notice Sets the reward per second to be distributed.
  /// @dev Can only be called by the owner.
  /// @param _newRewardPerSecond The amount of reward token to be distributed per second.
  function setRewardPerSecond(uint256 _newRewardPerSecond) external onlyOwner {
    if (_newRewardPerSecond > maxRewardPerSecond) revert Rewarder1_BadArguments();

    _updatePool();
    rewardPerSecond = _newRewardPerSecond;
    emit LogRewardPerSecond(_newRewardPerSecond);
  }

  /// @notice View function to see pending rewards for a given pool.

  /// @param _user Address of user.
  /// @return pending reward for a given user.
  function pendingToken(address _user) public view returns (uint256) {
    PoolInfo memory _poolInfo = poolInfo;
    UserInfo storage _userInfo = userInfo[_user];
    uint256 _accRewardPerShare = _poolInfo.accRewardPerShare;
    uint256 _stakedBalance = IMiniFL(miniFL).stakingReserve();
    if (block.timestamp > _poolInfo.lastRewardTime && _stakedBalance != 0) {
      uint256 _timePast;
      unchecked {
        _timePast = block.timestamp - _poolInfo.lastRewardTime;
      }
      uint256 _rewards = _timePast * rewardPerSecond;

      _accRewardPerShare = _accRewardPerShare + ((_rewards * ACC_REWARD_PRECISION) / _stakedBalance);
    }
    return
      (((_userInfo.amount * _accRewardPerShare) / ACC_REWARD_PRECISION).toInt256() - _userInfo.rewardDebt).toUint256();
  }

  /// @dev Perform the actual updatePool
  function _updatePool() internal returns (PoolInfo memory) {
    PoolInfo memory _poolInfo = poolInfo;

    if (_poolInfo.lastRewardTime == 0) revert Rewarder1_PoolNotExisted();

    if (block.timestamp > _poolInfo.lastRewardTime) {
      uint256 _stakedBalance = IMiniFL(miniFL).stakingReserve();
      if (_stakedBalance > 0) {
        uint256 _timePast;
        unchecked {
          _timePast = block.timestamp - _poolInfo.lastRewardTime;
        }
        uint256 _rewards = _timePast * rewardPerSecond;

        // increase accRewardPerShare with `_rewards/stakedBalance` amount
        // example:
        //  - oldaccRewardPerShare = 0
        //  - _rewards                = 2000
        //  - stakedBalance               = 10000
        //  _poolInfo.accRewardPerShare = oldaccRewardPerShare + (_rewards/stakedBalance)
        //  _poolInfo.accRewardPerShare = 0 + 2000/10000 = 0.2
        _poolInfo.accRewardPerShare =
          _poolInfo.accRewardPerShare +
          ((_rewards * ACC_REWARD_PRECISION) / _stakedBalance).toUint128();
      }
      _poolInfo.lastRewardTime = block.timestamp.toUint64();
      poolInfo = _poolInfo;
      emit LogUpdatePool(_poolInfo.lastRewardTime, _stakedBalance, _poolInfo.accRewardPerShare);
    }
    return _poolInfo;
  }

  /// @notice Update reward variables of the pool.
  /// @return pool Returns the pool that was updated.
  function updatePool() external returns (PoolInfo memory) {
    return _updatePool();
  }

  /// @notice Change the name of the rewarder.
  /// @param _newName The new name of the rewarder.
  function setName(string calldata _newName) external onlyOwner {
    name = _newName;
    emit LogSetName(_newName);
  }

  /// @notice Set max reward per second
  /// @param _newMaxRewardPerSecond The max reward per second
  function setMaxRewardPerSecond(uint256 _newMaxRewardPerSecond) external onlyOwner {
    if (_newMaxRewardPerSecond <= rewardPerSecond) revert Rewarder1_BadArguments();

    maxRewardPerSecond = _newMaxRewardPerSecond;
    emit LogSetMaxRewardPerSecond(_newMaxRewardPerSecond);
  }

  /// @notice Returns the number of pools.
  function poolLength() public view returns (uint256 _poolLength) {
    _poolLength = poolIds.length;
  }

  /// @notice Return the last reward time of the given pool id
  /// @return Last reward time
  function lastRewardTime() external view returns (uint256) {
    return poolInfo.lastRewardTime;
  }
}
