export interface Config {
  Timelock: string;
  FairLaunch: FairLaunch;
  Tokens: Tokens;
  xALPACA: string;
  ALPACAFeeder: string;
  GrassHouses: GrassHouse[];
  GrassHouseGateway: string;
}

export interface FairLaunch {
  address: string;
  deployedBlock: number;
  pools: PoolsEntity1[];
}

export interface PoolsEntity1 {
  id: number;
  stakingToken: string;
  address: string;
}

export interface Tokens {
  ALPACA: string;
  fdALPACA: string;
}

export interface GrassHouse {
  name: string;
  address: string;
  rewardToken: string;
}

export interface WorkersEntity {
  name: string;
  address: string;
  deployedBlock: number;
  config: string;
  pId: number;
  stakingToken: string;
  stakingTokenAt: string;
  strategies: Strategies;
}

export interface Strategies {
  StrategyAddAllBaseToken: string;
  StrategyLiquidate: string;
  StrategyAddTwoSidesOptimal: string;
  StrategyWithdrawMinimizeTrading: string;
  StrategyPartialCloseLiquidate: string;
  StrategyPartialCloseMinimizeTrading: string;
}
