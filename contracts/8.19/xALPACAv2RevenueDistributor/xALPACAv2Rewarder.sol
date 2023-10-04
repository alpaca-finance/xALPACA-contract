// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { SafeCastUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";

import { IxALPACAv2RevenueDistributor } from "./interfaces/IxALPACAv2RevenueDistributor.sol";
import { IxALPACAv2Rewarder } from "./interfaces/IxALPACAv2Rewarder.sol";

contract xALPACAv2Rewarder is IxALPACAv2Rewarder, OwnableUpgradeable, ReentrancyGuardUpgradeable {
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

  mapping(address => UserInfo) public userInfo;

  uint256 public rewardPerSecond;
  uint256 public rewardEndTimestamp;
  uint256 private constant ACC_REWARD_PRECISION = 1e12;

  address public xALPACAv2RevenueDistributor;
  string public name;

  event LogOnDeposit(address indexed _user, uint256 _amount);
  event LogOnWithdraw(address indexed _user, uint256 _amount);
  event LogHarvest(address indexed _user, uint256 _amount);
  event LogUpdatePool(uint64 _lastRewardTime, uint256 _stakedBalance, uint256 _accRewardPerShare);
  event LogFeed(uint256 _newRewardPerSecond, uint256 _newRewardEndTimestamp);
  event LogSetName(string _name);

  /// @dev allow only xALPACAv2RevenueDistributor
  modifier onlyxALPACAv2RevenueDistributor() {
    if (msg.sender != xALPACAv2RevenueDistributor) revert xALPACAv2Rewarder_NotxALPACAv2RevenueDistributor();
    _;
  }

  /// @dev allow only whitelised callers
  modifier onlyFeeder() {
    if (!IxALPACAv2RevenueDistributor(xALPACAv2RevenueDistributor).feeders(msg.sender)) {
      revert xALPACAv2Rewarder_Unauthorized();
    }
    _;
  }

  constructor() {
    _disableInitializers();
  }

  function initialize(
    string calldata _name,
    address _xALPACAv2RevenueDistributor,
    address _rewardToken
  ) external initializer {
    OwnableUpgradeable.__Ownable_init();
    ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

    // sanity check
    IERC20Upgradeable(_rewardToken).totalSupply();
    IxALPACAv2RevenueDistributor(_xALPACAv2RevenueDistributor).stakingReserve();

    name = _name;
    xALPACAv2RevenueDistributor = _xALPACAv2RevenueDistributor;
    rewardToken = _rewardToken;

    poolInfo = PoolInfo({ accRewardPerShare: 0, lastRewardTime: block.timestamp.toUint64() });
  }

  /// @notice Hook deposit action from xALPACAv2RevenueDistributor.
  /// @param _user The beneficary address of the deposit.
  /// @param _newAmount new staking amount from xALPACAv2RevenueDistributor.
  function onDeposit(address _user, uint256 _newAmount) external override onlyxALPACAv2RevenueDistributor {
    PoolInfo memory pool = _updatePool();
    UserInfo storage user = userInfo[_user];

    // calculate new staked amount
    // example: if user deposit another 500 shares
    //  - user.amount  = 100 => from previous deposit
    //  - _newAmount   = 600 => updated staking amount from xALPACAv2RevenueDistributor
    //  _amount = _newAmount - user.amount = 600 - 100 = 500
    uint256 _amount = _newAmount - user.amount;

    user.amount = _newAmount;
    // update user rewardDebt to separate new deposit share amount from pending reward in the pool
    // example:
    //  - accRewardPerShare    = 250
    //  - _receivedAmount      = 100
    //  - pendingRewardReward  = 25,000
    //  rewardDebt = oldRewardDebt + (_receivedAmount * accRewardPerShare)= 0 + (100 * 250) = 25,000
    //  This means newly deposit share does not eligible for 25,000 pending rewards
    user.rewardDebt = user.rewardDebt + ((_amount * pool.accRewardPerShare) / ACC_REWARD_PRECISION).toInt256();

    emit LogOnDeposit(_user, _amount);
  }

  /// @notice Hook Withdraw action from xALPACAv2RevenueDistributor.

  /// @param _user Withdraw from who?
  /// @param _newAmount new staking amount from xALPACAv2RevenueDistributor.
  function onWithdraw(address _user, uint256 _newAmount) external override onlyxALPACAv2RevenueDistributor {
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
      //  - accRewardPerShare    = 300
      //  - _amountToWithdraw    = 100
      //  - oldRewardDebt        = 25,000
      //  - pendingRewardReward  = 35,000
      //  rewardDebt = oldRewardDebt - (_amountToWithdraw * accRewardPerShare) = 25,000 - (100 * 300) = -5000
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

  /// @notice Hook Harvest action from xALPACAv2RevenueDistributor.
  /// @param _user The beneficary address.
  function onHarvest(address _user) external override onlyxALPACAv2RevenueDistributor {
    PoolInfo memory pool = _updatePool();
    UserInfo storage user = userInfo[_user];

    // example:
    //  - totalAmount         = 100
    //  - accRewardPerShare   = 250
    //  - rewardDebt          = 0
    //  accumulatedReward     = totalAmount * accRewardPerShare = 100 * 250 = 25,000
    //  _pendingReward         = accumulatedReward - rewardDebt = 25,000 - 0 = 25,000
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
  /// @param _rewardAmount The amount of reward token to be distributed.
  /// @param _newRewardEndTimestamp The time that reward will stop
  function feed(uint256 _rewardAmount, uint256 _newRewardEndTimestamp) external onlyFeeder {
    if (_newRewardEndTimestamp <= block.timestamp) {
      revert xALPACAv2Rewarder_InvalidArguments();
    }

    _updatePool();

    // in case we only change the reward end timestamp
    // skip the token transfer
    if (_rewardAmount > 0) {
      IERC20Upgradeable(rewardToken).safeTransferFrom(msg.sender, address(this), _rewardAmount);
    }

    // roll over outstanding reward
    if (rewardEndTimestamp > block.timestamp) {
      _rewardAmount += (rewardEndTimestamp - block.timestamp) * rewardPerSecond;
    }

    // roll over outstanding reward
    rewardPerSecond = _rewardAmount / (_newRewardEndTimestamp - block.timestamp);
    rewardEndTimestamp = _newRewardEndTimestamp;
    emit LogFeed(rewardPerSecond, _newRewardEndTimestamp);
  }

  /// @notice View function to see pending rewards for a given pool.

  /// @param _user Address of user.
  /// @return pending reward for a given user.
  function pendingToken(address _user) external view returns (uint256) {
    PoolInfo memory _poolInfo = poolInfo;
    UserInfo storage _userInfo = userInfo[_user];
    uint256 _accRewardPerShare = _poolInfo.accRewardPerShare;
    uint256 _stakedBalance = IxALPACAv2RevenueDistributor(xALPACAv2RevenueDistributor).stakingReserve();
    if (block.timestamp > _poolInfo.lastRewardTime && _stakedBalance != 0) {
      // if reward has ended, accumulated only before reward end
      // otherwise, accumulated up to now
      uint256 _timePast = block.timestamp > rewardEndTimestamp
        ? rewardEndTimestamp - _poolInfo.lastRewardTime
        : block.timestamp - _poolInfo.lastRewardTime;

      // calculate total reward since lastRewardTime
      uint256 _rewards;
      {
        // if the reward has ended, overwrite reward per sec to 0
        uint256 _rewardPerSecond = _poolInfo.lastRewardTime < rewardEndTimestamp ? rewardPerSecond : 0;

        _rewards = _timePast * _rewardPerSecond;
      }

      _accRewardPerShare = _accRewardPerShare + ((_rewards * ACC_REWARD_PRECISION) / _stakedBalance);
    }
    return
      (((_userInfo.amount * _accRewardPerShare) / ACC_REWARD_PRECISION).toInt256() - _userInfo.rewardDebt).toUint256();
  }

  /// @dev Perform the actual updatePool
  function _updatePool() internal returns (PoolInfo memory) {
    PoolInfo memory _poolInfo = poolInfo;

    if (block.timestamp > _poolInfo.lastRewardTime) {
      uint256 _stakedBalance = IxALPACAv2RevenueDistributor(xALPACAv2RevenueDistributor).stakingReserve();
      if (_stakedBalance > 0) {
        // if reward has ended, accumulated only before reward end
        // otherwise, accumulated up to now
        uint256 _timePast = block.timestamp > rewardEndTimestamp
          ? rewardEndTimestamp - _poolInfo.lastRewardTime
          : block.timestamp - _poolInfo.lastRewardTime;

        // calculate total rewardReward since lastRewardTime
        uint256 _rewards;
        {
          // if the reward has ended, overwrite reward per sec to 0
          uint256 _rewardPerSecond = _poolInfo.lastRewardTime < rewardEndTimestamp ? rewardPerSecond : 0;

          _rewards = _timePast * _rewardPerSecond;
        }

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

  /// @notice Return the last reward time of the given pool id
  /// @return Last reward time
  function lastRewardTime() external view returns (uint256) {
    return poolInfo.lastRewardTime;
  }
}
