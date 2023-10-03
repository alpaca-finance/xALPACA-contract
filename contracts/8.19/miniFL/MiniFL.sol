// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { SafeCastUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";

import { IMiniFL } from "./interfaces/IMiniFL.sol";
import { IRewarder } from "./interfaces/IRewarder.sol";

contract MiniFL is IMiniFL, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  using SafeCastUpgradeable for uint256;
  using SafeCastUpgradeable for int256;
  using SafeERC20Upgradeable for IERC20Upgradeable;

  event LogDeposit(address indexed _caller, address indexed _user, uint256 _amount);
  event LogWithdraw(address indexed _caller, address indexed _user, uint256 _amount);
  event LogEmergencyWithdraw(address indexed _user, uint256 _amount);
  event LogHarvest(address indexed _user, uint256 _amount);
  event LogUpdatePool(uint64 _lastRewardTime, uint256 _stakedBalance, uint256 _accAlpacaPerShare);
  event LogFeed(uint256 _newAlpacaPerSecond, uint256 _rewardEndTimestamp);
  event LogApproveStakeDebtToken(address indexed _staker, bool _allow);
  event LogSetPoolRewarder(address _rewarder);
  event LogSetWhitelistedCaller(address indexed _caller, bool _allow);
  event LogSetWhitelistedFeeder(address indexed _feeder, bool _allow);

  struct UserInfo {
    uint256 totalAmount;
    int256 rewardDebt;
  }

  struct PoolInfo {
    uint128 accAlpacaPerShare;
    uint64 lastRewardTime;
  }

  address public ALPACA;
  PoolInfo public poolInfo;

  address[] public rewarders;
  uint256 public stakingReserve;

  mapping(address => UserInfo) public userInfo;
  mapping(address => bool) public whitelistedCallers;
  mapping(address => bool) public feeders;

  uint256 public alpacaPerSecond;
  uint256 private constant ACC_ALPACA_PRECISION = 1e12;

  uint256 public rewardEndTimestamp;

  /// @dev allow only whitelised callers
  modifier onlyWhitelisted() {
    if (!whitelistedCallers[msg.sender]) {
      revert MiniFL_Unauthorized();
    }
    _;
  }

  /// @dev allow only whitelised callers
  modifier onlyFeeder() {
    if (!feeders[msg.sender]) {
      revert MiniFL_Unauthorized();
    }
    _;
  }

  constructor() {
    _disableInitializers();
  }

  /// @param _alpaca The ALPACA token contract address.
  function initialize(address _alpaca) external initializer {
    OwnableUpgradeable.__Ownable_init();
    ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

    ALPACA = _alpaca;

    poolInfo = PoolInfo({ lastRewardTime: block.timestamp.toUint64(), accAlpacaPerShare: 0 });
  }

  /// @notice Sets the ALPACA per second to be distributed. Can only be called by the owner.
  /// @param _rewardAmount The amount of ALPACA to be distributed
  /// @param _newRewardEndTimestamp The time that reward will stop
  function feed(uint256 _rewardAmount, uint256 _newRewardEndTimestamp) external onlyFeeder {
    if (_newRewardEndTimestamp <= block.timestamp) {
      revert MiniFL_InvalidArguments();
    }

    // in case we only change the reward end timestamp
    // skip the token transfer
    if (_rewardAmount > 0) {
      IERC20Upgradeable(ALPACA).safeTransferFrom(msg.sender, address(this), _rewardAmount);
    }

    _updatePool();
    // roll over outstanding reward
    if (rewardEndTimestamp > block.timestamp) {
      _rewardAmount += (rewardEndTimestamp - block.timestamp) * alpacaPerSecond;
    }

    alpacaPerSecond = _rewardAmount / (_newRewardEndTimestamp - block.timestamp);
    rewardEndTimestamp = _newRewardEndTimestamp;

    emit LogFeed(alpacaPerSecond, _newRewardEndTimestamp);
  }

  /// @notice View function to see pending ALPACA on frontend.

  /// @param _user Address of a user.
  /// @return pending ALPACA reward for a given user.
  function pendingAlpaca(address _user) external view returns (uint256) {
    UserInfo storage user = userInfo[_user];
    PoolInfo memory _poolInfo = poolInfo;

    uint256 accAlpacaPerShare = _poolInfo.accAlpacaPerShare;
    uint256 stakedBalance = stakingReserve;
    if (block.timestamp > _poolInfo.lastRewardTime && stakedBalance != 0) {
      // if reward has ended, accumulated only before reward end
      // otherwise, accumulated up to now
      uint256 _timePast = block.timestamp > rewardEndTimestamp
        ? rewardEndTimestamp - _poolInfo.lastRewardTime
        : block.timestamp - _poolInfo.lastRewardTime;

      uint256 _alpacaReward;
      {
        // if the reward has ended, overwrite alpaca per sec to 0
        uint256 _alpacaPerSecond = _poolInfo.lastRewardTime < rewardEndTimestamp ? alpacaPerSecond : 0;
        _alpacaReward = _timePast * _alpacaPerSecond;
      }

      accAlpacaPerShare = accAlpacaPerShare + ((_alpacaReward * ACC_ALPACA_PRECISION) / stakedBalance);
    }

    return (((user.totalAmount * accAlpacaPerShare) / ACC_ALPACA_PRECISION).toInt256() - user.rewardDebt).toUint256();
  }

  /// @dev Perform actual update pool.
  /// @return _poolInfo Returns the pool that was updated.
  function _updatePool() internal returns (PoolInfo memory _poolInfo) {
    _poolInfo = poolInfo;
    if (block.timestamp > _poolInfo.lastRewardTime) {
      uint256 stakedBalance = stakingReserve;
      if (stakedBalance > 0) {
        // if reward has ended, accumulated only before reward end
        // otherwise, accumulated up to now
        uint256 _timePast = block.timestamp > rewardEndTimestamp
          ? rewardEndTimestamp - _poolInfo.lastRewardTime
          : block.timestamp - _poolInfo.lastRewardTime;

        // calculate total alpacaReward since lastRewardTime for this _pid
        uint256 _alpacaReward;
        {
          // if the reward has ended, overwrite alpaca per sec to 0
          uint256 _alpacaPerSecond = _poolInfo.lastRewardTime < rewardEndTimestamp ? alpacaPerSecond : 0;

          _alpacaReward = _timePast * _alpacaPerSecond;
        }

        // increase accAlpacaPerShare with `_alpacaReward/stakedBalance` amount
        // example:
        //  - oldAccAlpacaPerShare = 0
        //  - _alpacaReward                = 2000
        //  - stakedBalance               = 10000
        //  _poolInfo.accAlpacaPerShare = oldAccAlpacaPerShare + (_alpacaReward/stakedBalance)
        //  _poolInfo.accAlpacaPerShare = 0 + 2000/10000 = 0.2
        _poolInfo.accAlpacaPerShare =
          _poolInfo.accAlpacaPerShare +
          ((_alpacaReward * ACC_ALPACA_PRECISION) / stakedBalance).toUint128();
      }
      _poolInfo.lastRewardTime = block.timestamp.toUint64();
      // update memory poolInfo in state
      poolInfo = _poolInfo;
      emit LogUpdatePool(_poolInfo.lastRewardTime, stakedBalance, _poolInfo.accAlpacaPerShare);
    }
  }

  /// @notice Update reward variables of the pool.
  /// @return pool Returns the pool that was updated.
  function updatePool() external nonReentrant returns (PoolInfo memory) {
    return _updatePool();
  }

  /// @notice Deposit tokens to MiniFL
  /// @param _for The beneficary address of the deposit.
  /// @param _amountToDeposit amount to deposit.
  function deposit(address _for, uint256 _amountToDeposit) external onlyWhitelisted nonReentrant {
    UserInfo storage user = userInfo[_for];

    // call _updatePool in order to update poolInfo.accAlpacaPerShare
    PoolInfo memory _poolInfo = _updatePool();

    uint256 _receivedAmount = _unsafePullToken(msg.sender, ALPACA, _amountToDeposit);

    // Effects
    // can do unchecked since staked token totalSuply < max(uint256)
    unchecked {
      user.totalAmount = user.totalAmount + _receivedAmount;
      stakingReserve += _receivedAmount;
    }

    // update user rewardDebt to separate new deposit share amount from pending reward in the pool
    // example:
    //  - accAlpacaPerShare    = 250
    //  - _receivedAmount      = 100
    //  - pendingAlpacaReward  = 25,000
    //  rewardDebt = oldRewardDebt + (_receivedAmount * accAlpacaPerShare)= 0 + (100 * 250) = 25,000
    //  This means newly deposit share does not eligible for 25,000 pending rewards
    user.rewardDebt =
      user.rewardDebt +
      ((_receivedAmount * _poolInfo.accAlpacaPerShare) / ACC_ALPACA_PRECISION).toInt256();

    // Interactions
    uint256 _rewarderLength = rewarders.length;
    address _rewarder;
    for (uint256 _i; _i < _rewarderLength; ) {
      _rewarder = rewarders[_i];
      // rewarder callback to do accounting
      IRewarder(_rewarder).onDeposit(_for, user.totalAmount);
      unchecked {
        ++_i;
      }
    }

    emit LogDeposit(msg.sender, _for, _receivedAmount);
  }

  /// @notice Withdraw tokens from MiniFL.
  /// @param _from Withdraw from who?
  /// @param _amountToWithdraw Staking token amount to withdraw.
  function withdraw(address _from, uint256 _amountToWithdraw) external onlyWhitelisted nonReentrant {
    UserInfo storage user = userInfo[_from];

    if (user.totalAmount < _amountToWithdraw) {
      revert MiniFL_InsufficientAmount();
    }

    // Effects

    // call _updatePool in order to update poolInfo.accAlpacaPerShare
    PoolInfo memory _poolInfo = _updatePool();

    unchecked {
      user.totalAmount -= _amountToWithdraw;
      stakingReserve -= _amountToWithdraw;
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
      (((_amountToWithdraw * _poolInfo.accAlpacaPerShare) / ACC_ALPACA_PRECISION)).toInt256();

    // Interactions
    uint256 _rewarderLength = rewarders.length;
    address _rewarder;
    for (uint256 _i; _i < _rewarderLength; ) {
      _rewarder = rewarders[_i];
      // rewarder callback to do accounting
      IRewarder(_rewarder).onWithdraw(_from, user.totalAmount);
      unchecked {
        ++_i;
      }
    }

    // transfer stakingToken to caller
    IERC20Upgradeable(ALPACA).safeTransfer(msg.sender, _amountToWithdraw);

    emit LogWithdraw(msg.sender, _from, _amountToWithdraw);
  }

  /// @notice Harvest ALPACA rewards
  function harvest() external nonReentrant {
    // simply call _harvest
    _harvest();
  }

  /// @dev Harvest ALPACA rewards
  function _harvest() internal {
    UserInfo storage user = userInfo[msg.sender];

    // call _updatePool in order to update poolInfo.accAlpacaPerShare
    PoolInfo memory _poolInfo = _updatePool();

    // example:
    //  - totalAmount         = 100
    //  - accAlpacaPerShare   = 250
    //  - rewardDebt          = 0
    //  accumulatedAlpaca     = totalAmount * accAlpacaPerShare = 100 * 250 = 25,000
    //  _pendingAlpaca         = accumulatedAlpaca - rewardDebt = 25,000 - 0 = 25,000
    //   Meaning user eligible for 25,000 rewards in this harvest
    int256 accumulatedAlpaca = ((user.totalAmount * _poolInfo.accAlpacaPerShare) / ACC_ALPACA_PRECISION).toInt256();
    uint256 _pendingAlpaca = (accumulatedAlpaca - user.rewardDebt).toUint256();

    // update user.rewardDebt so that user no longer eligible for already harvest rewards
    // Effects
    user.rewardDebt = accumulatedAlpaca;

    // Interactions
    if (_pendingAlpaca != 0) {
      IERC20Upgradeable(ALPACA).safeTransfer(msg.sender, _pendingAlpaca);
    }

    uint256 _rewarderLength = rewarders.length;
    address _rewarder;
    for (uint256 _i; _i < _rewarderLength; ) {
      _rewarder = rewarders[_i];
      // rewarder callback to claim reward
      IRewarder(_rewarder).onHarvest(msg.sender);
      unchecked {
        ++_i;
      }
    }

    emit LogHarvest(msg.sender, _pendingAlpaca);
  }

  /// @notice Set rewarders in Pool
  /// @param _newRewarders rewarders
  function setPoolRewarders(address[] calldata _newRewarders) external onlyOwner {
    uint256 _length = _newRewarders.length;
    address _rewarder;
    // loop to check rewarder should be belong to this MiniFL only
    for (uint256 _i; _i < _length; ) {
      _rewarder = _newRewarders[_i];
      if ((IRewarder(_rewarder).miniFL() != address(this)) || (IRewarder(_rewarder).lastRewardTime() == 0)) {
        revert MiniFL_BadRewarder();
      }
      unchecked {
        ++_i;
      }
    }

    rewarders = _newRewarders;
  }

  /// @dev A routine for tranfering token in. Prevent wrong accounting when token has fee on tranfer
  /// @param _from The address to transfer token from
  /// @param _token The address of token to transfer
  /// @param _amount The amount to transfer
  /// @return _receivedAmount The actual amount received after transfer
  function _unsafePullToken(
    address _from,
    address _token,
    uint256 _amount
  ) internal returns (uint256 _receivedAmount) {
    uint256 _currentTokenBalance = IERC20Upgradeable(_token).balanceOf(address(this));
    IERC20Upgradeable(_token).safeTransferFrom(_from, address(this), _amount);
    _receivedAmount = IERC20Upgradeable(_token).balanceOf(address(this)) - _currentTokenBalance;
  }

  /// @notice Set whitelisted callers
  /// @param _callers The addresses of the callers that are going to be whitelisted.
  /// @param _allow Whether to allow or disallow callers.
  function setWhitelistedCallers(address[] calldata _callers, bool _allow) external onlyOwner {
    uint256 _length = _callers.length;
    for (uint256 _i; _i < _length; ) {
      whitelistedCallers[_callers[_i]] = _allow;
      emit LogSetWhitelistedCaller(_callers[_i], _allow);

      unchecked {
        ++_i;
      }
    }
  }

  /// @notice Set whitelisted feeders
  /// @param _feeders The addresses of the feeders that are going to be whitelisted.
  /// @param _allow Whether to allow or disallow feeders.
  function setWhitelistedFeeders(address[] calldata _feeders, bool _allow) external onlyOwner {
    uint256 _length = _feeders.length;
    for (uint256 _i; _i < _length; ) {
      feeders[_feeders[_i]] = _allow;
      emit LogSetWhitelistedFeeder(_feeders[_i], _allow);

      unchecked {
        ++_i;
      }
    }
  }

  /// @notice Get total amount of a user
  /// @param _user The address of the user.
  function getUserTotalAmountOf(address _user) external view returns (uint256 _totalAmount) {
    _totalAmount = userInfo[_user].totalAmount;
  }

  /// @notice Get reward debt of a user
  /// @param _user The address of the user.
  function getUserRewardDebtOf(address _user) external view returns (int256 _rewardDebt) {
    _rewardDebt = userInfo[_user].rewardDebt;
  }
}
