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

  event LogDeposit(address indexed _caller, address indexed _user, uint256 indexed _pid, uint256 _amount);
  event LogWithdraw(address indexed _caller, address indexed _user, uint256 indexed _pid, uint256 _amount);
  event LogEmergencyWithdraw(address indexed _user, uint256 indexed _pid, uint256 _amount);
  event LogHarvest(address indexed _user, uint256 indexed _pid, uint256 _amount);
  event LogAddPool(uint256 indexed _pid, uint256 _allocPoint, address indexed _stakingToken);
  event LogSetPool(uint256 indexed _pid, uint256 _newAllocPoint);
  event LogUpdatePool(uint256 indexed _pid, uint64 _lastRewardTime, uint256 _stakedBalance, uint256 _accAlpacaPerShare);
  event LogAlpacaPerSecond(uint256 _newAlpacaPerSecond);
  event LogApproveStakeDebtToken(uint256 indexed _pid, address indexed _staker, bool _allow);
  event LogSetMaxAlpacaPerSecond(uint256 _maxAlpacaPerSecond);
  event LogSetPoolRewarder(uint256 indexed _pid, address _rewarder);
  event LogSetWhitelistedCaller(address indexed _caller, bool _allow);

  struct UserInfo {
    mapping(address => uint256) fundedAmounts; // funders address => amount
    uint256 totalAmount;
    int256 rewardDebt;
  }

  struct PoolInfo {
    uint128 accAlpacaPerShare;
    uint64 lastRewardTime;
    uint64 allocPoint;
  }

  address public ALPACA;
  PoolInfo[] public poolInfo;
  address[] public stakingTokens;

  mapping(uint256 => address[]) public rewarders;
  mapping(address => bool) public isStakingToken;
  mapping(address => uint256) public stakingReserves;

  mapping(uint256 => mapping(address => UserInfo)) public userInfo; // pool id => user
  mapping(address => bool) public whitelistedCallers;

  uint256 public totalAllocPoint;
  uint256 public alpacaPerSecond;
  uint256 private constant ACC_ALPACA_PRECISION = 1e12;
  uint256 public maxAlpacaPerSecond;

  /// @dev allow only whitelised callers
  modifier onlyWhitelisted() {
    if (!whitelistedCallers[msg.sender]) {
      revert MiniFL_Unauthorized();
    }
    _;
  }

  constructor() {
    _disableInitializers();
  }

  /// @param _alpaca The ALPACA token contract address.
  function initialize(address _alpaca, uint256 _maxAlpacaPerSecond) external initializer {
    OwnableUpgradeable.__Ownable_init();
    ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

    ALPACA = _alpaca;
    maxAlpacaPerSecond = _maxAlpacaPerSecond;

    // The first pool is going to be a dummy pool where nobody uses.
    // This is to prevent confusion whether PID 0 is a valid pool or not
    poolInfo.push(PoolInfo({ allocPoint: 0, lastRewardTime: block.timestamp.toUint64(), accAlpacaPerShare: 0 }));
    stakingTokens.push(address(0));
  }

  /// @notice Add a new staking token pool. Can only be called by the owner.
  /// @param _allocPoint AP of the new pool.
  /// @param _stakingToken Address of the staking token.
  /// @param _withUpdate If true, do mass update pools.
  /// @return _pid The index of the new pool.
  function addPool(
    uint256 _allocPoint,
    address _stakingToken,
    bool _withUpdate
  ) external onlyWhitelisted returns (uint256 _pid) {
    if (_stakingToken == ALPACA) {
      revert MiniFL_InvalidArguments();
    }

    // Revert if a pool for _stakingToken already exists
    if (isStakingToken[_stakingToken]) {
      revert MiniFL_DuplicatePool();
    }

    // Sanity check that the staking token is a valid ERC20 token.
    IERC20Upgradeable(_stakingToken).balanceOf(address(this));

    if (_withUpdate) massUpdatePools();

    totalAllocPoint = totalAllocPoint + _allocPoint;
    stakingTokens.push(_stakingToken);
    isStakingToken[_stakingToken] = true;

    poolInfo.push(
      PoolInfo({ allocPoint: _allocPoint.toUint64(), lastRewardTime: block.timestamp.toUint64(), accAlpacaPerShare: 0 })
    );

    // possible to unchecked
    // since poolInfo is always pushed before going to this statement
    unchecked {
      _pid = poolInfo.length - 1;
    }
    emit LogAddPool(_pid, _allocPoint, _stakingToken);
  }

  /// @notice Update the given pool's ALPACA allocation point and `IRewarder` contract.
  /// @dev Can only be called by the owner.
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _newAllocPoint New AP of the pool.
  /// @param _withUpdate If true, do mass update pools
  function setPool(
    uint256 _pid,
    uint256 _newAllocPoint,
    bool _withUpdate
  ) external onlyOwner {
    // prevent setting allocPoint of dummy pool
    if (_pid == 0) revert MiniFL_InvalidArguments();
    if (_withUpdate) massUpdatePools();

    totalAllocPoint = totalAllocPoint - poolInfo[_pid].allocPoint + _newAllocPoint;
    poolInfo[_pid].allocPoint = _newAllocPoint.toUint64();

    emit LogSetPool(_pid, _newAllocPoint);
  }

  /// @notice Sets the ALPACA per second to be distributed. Can only be called by the owner.
  /// @param _newAlpacaPerSecond The amount of ALPACA to be distributed per second.
  /// @param _withUpdate If true, do mass update pools
  function setAlpacaPerSecond(uint256 _newAlpacaPerSecond, bool _withUpdate) external onlyOwner {
    if (_newAlpacaPerSecond > maxAlpacaPerSecond) {
      revert MiniFL_InvalidArguments();
    }
    if (_withUpdate) massUpdatePools();
    alpacaPerSecond = _newAlpacaPerSecond;
    emit LogAlpacaPerSecond(_newAlpacaPerSecond);
  }

  /// @notice View function to see pending ALPACA on frontend.
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _user Address of a user.
  /// @return pending ALPACA reward for a given user.
  function pendingAlpaca(uint256 _pid, address _user) external view returns (uint256) {
    UserInfo storage user = userInfo[_pid][_user];
    PoolInfo memory _poolInfo = poolInfo[_pid];

    uint256 accAlpacaPerShare = _poolInfo.accAlpacaPerShare;
    uint256 stakedBalance = stakingReserves[stakingTokens[_pid]];
    if (block.timestamp > _poolInfo.lastRewardTime && stakedBalance != 0) {
      uint256 timePast;
      unchecked {
        timePast = block.timestamp - _poolInfo.lastRewardTime;
      }

      uint256 alpacaReward = totalAllocPoint != 0
        ? (timePast * alpacaPerSecond * _poolInfo.allocPoint) / totalAllocPoint
        : 0;
      accAlpacaPerShare = accAlpacaPerShare + ((alpacaReward * ACC_ALPACA_PRECISION) / stakedBalance);
    }

    return (((user.totalAmount * accAlpacaPerShare) / ACC_ALPACA_PRECISION).toInt256() - user.rewardDebt).toUint256();
  }

  /// @dev Perform actual update pool.
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @return _poolInfo Returns the pool that was updated.
  function _updatePool(uint256 _pid) internal returns (PoolInfo memory _poolInfo) {
    _poolInfo = poolInfo[_pid];
    if (block.timestamp > _poolInfo.lastRewardTime) {
      uint256 stakedBalance = stakingReserves[stakingTokens[_pid]];
      if (stakedBalance > 0) {
        uint256 timePast;
        // can do unchecked since always block.timestamp >= lastRewardTime
        unchecked {
          timePast = block.timestamp - _poolInfo.lastRewardTime;
        }
        // calculate total alpacaReward since lastRewardTime for this _pid
        uint256 alpacaReward = totalAllocPoint != 0
          ? (timePast * alpacaPerSecond * _poolInfo.allocPoint) / totalAllocPoint
          : 0;

        // increase accAlpacaPerShare with `alpacaReward/stakedBalance` amount
        // example:
        //  - oldAccAlpacaPerShare = 0
        //  - alpacaReward                = 2000
        //  - stakedBalance               = 10000
        //  _poolInfo.accAlpacaPerShare = oldAccAlpacaPerShare + (alpacaReward/stakedBalance)
        //  _poolInfo.accAlpacaPerShare = 0 + 2000/10000 = 0.2
        _poolInfo.accAlpacaPerShare =
          _poolInfo.accAlpacaPerShare +
          ((alpacaReward * ACC_ALPACA_PRECISION) / stakedBalance).toUint128();
      }
      _poolInfo.lastRewardTime = block.timestamp.toUint64();
      // update memory poolInfo in state
      poolInfo[_pid] = _poolInfo;
      emit LogUpdatePool(_pid, _poolInfo.lastRewardTime, stakedBalance, _poolInfo.accAlpacaPerShare);
    }
  }

  /// @notice Update reward variables of the given pool.
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @return pool Returns the pool that was updated.
  function updatePool(uint256 _pid) external nonReentrant returns (PoolInfo memory) {
    return _updatePool(_pid);
  }

  /// @notice Update reward variables for a given pools.
  function updatePools(uint256[] calldata _pids) external nonReentrant {
    uint256 len = _pids.length;
    for (uint256 _i; _i < len; ) {
      _updatePool(_pids[_i]);
      unchecked {
        ++_i;
      }
    }
  }

  /// @notice Update reward variables for all pools.
  function massUpdatePools() public nonReentrant {
    uint256 len = poolLength();
    for (uint256 _i; _i < len; ) {
      _updatePool(_i);
      unchecked {
        ++_i;
      }
    }
  }

  /// @notice Deposit tokens to MiniFL for ALPACA allocation.
  /// @param _for The beneficary address of the deposit.
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _amountToDeposit amount to deposit.
  function deposit(
    address _for,
    uint256 _pid,
    uint256 _amountToDeposit
  ) external onlyWhitelisted nonReentrant {
    UserInfo storage user = userInfo[_pid][_for];

    // call _updatePool in order to update poolInfo.accAlpacaPerShare
    PoolInfo memory _poolInfo = _updatePool(_pid);

    address _stakingToken = stakingTokens[_pid];
    uint256 _receivedAmount = _unsafePullToken(msg.sender, _stakingToken, _amountToDeposit);

    // Effects
    // can do unchecked since staked token totalSuply < max(uint256)
    unchecked {
      user.fundedAmounts[msg.sender] += _receivedAmount;
      user.totalAmount = user.totalAmount + _receivedAmount;
      stakingReserves[_stakingToken] += _receivedAmount;
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
    uint256 _rewarderLength = rewarders[_pid].length;
    address _rewarder;
    for (uint256 _i; _i < _rewarderLength; ) {
      _rewarder = rewarders[_pid][_i];
      // rewarder callback to do accounting
      IRewarder(_rewarder).onDeposit(_pid, _for, user.totalAmount);
      unchecked {
        ++_i;
      }
    }

    emit LogDeposit(msg.sender, _for, _pid, _receivedAmount);
  }

  /// @notice Withdraw tokens from MiniFL.
  /// @param _from Withdraw from who?
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _amountToWithdraw Staking token amount to withdraw.
  function withdraw(
    address _from,
    uint256 _pid,
    uint256 _amountToWithdraw
  ) external onlyWhitelisted nonReentrant {
    UserInfo storage user = userInfo[_pid][_from];

    // call _updatePool in order to update poolInfo.accAlpacaPerShare
    PoolInfo memory _poolInfo = _updatePool(_pid);

    // caller couldn't withdraw more than their funded
    if (_amountToWithdraw > user.fundedAmounts[msg.sender]) {
      revert MiniFL_InsufficientFundedAmount();
    }

    address _stakingToken = stakingTokens[_pid];

    // Effects
    unchecked {
      user.fundedAmounts[msg.sender] -= _amountToWithdraw;

      // total amount & staking reserves always >= user.fundedAmounts[msg.sender]
      user.totalAmount -= _amountToWithdraw;
      stakingReserves[_stakingToken] -= _amountToWithdraw;
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
    uint256 _rewarderLength = rewarders[_pid].length;
    address _rewarder;
    for (uint256 _i; _i < _rewarderLength; ) {
      _rewarder = rewarders[_pid][_i];
      // rewarder callback to do accounting
      IRewarder(_rewarder).onWithdraw(_pid, _from, user.totalAmount);
      unchecked {
        ++_i;
      }
    }

    // transfer stakingToken to caller
    IERC20Upgradeable(_stakingToken).safeTransfer(msg.sender, _amountToWithdraw);

    emit LogWithdraw(msg.sender, _from, _pid, _amountToWithdraw);
  }

  /// @notice Harvest ALPACA rewards
  /// @param _pid The index of the pool. See `poolInfo`.
  function harvest(uint256 _pid) external nonReentrant {
    // simply call _harvest
    _harvest(_pid);
  }

  /// @notice Harvest ALPACA rewards from multiple pools
  /// @param _pids A list of index of the pools. See `poolInfo`.
  function harvestMany(uint256[] calldata _pids) external nonReentrant {
    uint256 length = _pids.length;
    for (uint256 _i; _i < length; ) {
      _harvest(_pids[_i]);
      unchecked {
        ++_i;
      }
    }
  }

  /// @dev Harvest ALPACA rewards
  /// @param _pid The index of the pool. See `poolInfo`.
  function _harvest(uint256 _pid) internal {
    UserInfo storage user = userInfo[_pid][msg.sender];

    // call _updatePool in order to update poolInfo.accAlpacaPerShare
    PoolInfo memory _poolInfo = _updatePool(_pid);

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

    uint256 _rewarderLength = rewarders[_pid].length;
    address _rewarder;
    for (uint256 _i; _i < _rewarderLength; ) {
      _rewarder = rewarders[_pid][_i];
      // rewarder callback to claim reward
      IRewarder(_rewarder).onHarvest(_pid, msg.sender);
      unchecked {
        ++_i;
      }
    }

    emit LogHarvest(msg.sender, _pid, _pendingAlpaca);
  }

  /// @notice Set max reward per second
  /// @param _newMaxAlpacaPerSecond The max reward per second
  function setMaxAlpacaPerSecond(uint256 _newMaxAlpacaPerSecond) external onlyOwner {
    if (_newMaxAlpacaPerSecond < alpacaPerSecond) {
      revert MiniFL_InvalidArguments();
    }
    maxAlpacaPerSecond = _newMaxAlpacaPerSecond;
    emit LogSetMaxAlpacaPerSecond(_newMaxAlpacaPerSecond);
  }

  /// @notice Set rewarders in Pool
  /// @param _pid pool id
  /// @param _newRewarders rewarders
  function setPoolRewarders(uint256 _pid, address[] calldata _newRewarders) external onlyOwner {
    if (_pid == 0) {
      revert MiniFL_InvalidArguments();
    }
    uint256 _length = _newRewarders.length;
    address _rewarder;
    // loop to check rewarder should be belong to this MiniFL only
    for (uint256 _i; _i < _length; ) {
      _rewarder = _newRewarders[_i];
      if ((IRewarder(_rewarder).miniFL() != address(this)) || (IRewarder(_rewarder).lastRewardTime(_pid) == 0)) {
        revert MiniFL_BadRewarder();
      }
      unchecked {
        ++_i;
      }
    }

    rewarders[_pid] = _newRewarders;
  }

  /// @notice Get amount of total staking token at pid
  /// @param _pid pool id
  function getStakingReserves(uint256 _pid) external view returns (uint256 _reserveAmount) {
    _reserveAmount = stakingReserves[stakingTokens[_pid]];
  }

  /// @notice Get amount of staking token funded for a user at pid
  /// @param _funder funder address
  /// @param _for user address
  /// @param _pid pool id
  function getUserAmountFundedBy(
    address _funder,
    address _for,
    uint256 _pid
  ) external view returns (uint256 _stakingAmount) {
    _stakingAmount = userInfo[_pid][_for].fundedAmounts[_funder];
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

  /// @notice Get total amount of a user
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _user The address of the user.
  function getUserTotalAmountOf(uint256 _pid, address _user) external view returns (uint256 _totalAmount) {
    _totalAmount = userInfo[_pid][_user].totalAmount;
  }

  /// @notice Get reward debt of a user
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _user The address of the user.
  function getUserRewardDebtOf(uint256 _pid, address _user) external view returns (int256 _rewardDebt) {
    _rewardDebt = userInfo[_pid][_user].rewardDebt;
  }

  /// @notice Returns the number of pools.
  function poolLength() public view returns (uint256 _poolLength) {
    _poolLength = poolInfo.length;
  }

  /// @notice Returns the allocation point of a pool.
  /// @param _pid The index of the pool. See `poolInfo`.
  function getPoolAllocPoint(uint256 _pid) external view returns (uint256 _allocPoint) {
    _allocPoint = poolInfo[_pid].allocPoint;
  }
}
