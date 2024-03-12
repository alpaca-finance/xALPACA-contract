export interface Config {
  ProxyAdmin: string;
  Timelock: string;
  OpMultiSig: string;
  FairLaunch?: FairLaunch;
  MiniFL?: MiniFL;
  Scientix?: Scientix;
  Tokens: Tokens;
  xALPACA: string;
  ALPACAFeeder: string;
  GrassHouses: GrassHouse[];
  GrassHouseGateway: string;
  xALPACAv2?: string;
  xALPACAv2RevenueDistributor?: string;
  xALPACAv2Rewarders: xALPACAv2Rewarder[];
}

export interface FairLaunch {
  address: string;
  deployedBlock: number;
  pools: Pool[];
}

export interface MiniFL {
  address: string;
  deployedBlock: number;
  pools: PoolsEntity2[];
}

export interface PoolsEntity2 {
  id: number;
  stakingToken: string;
  address: string;
  rewarder: string;
}

export interface Pool {
  id: number;
  stakingToken: string;
  address: string;
}

export interface Scientix {
  StakingPools: StakingPools;
}

export interface StakingPools {
  address: string;
  deployedBlock: number;
  pools: Pool2[];
}

export interface Pool2 {
  id: number;
  name: string;
  stakingToken: string;
  rewardToken: string;
}

export interface Tokens {
  ALPACA?: string;
  fdALPACA?: string;
  SCIX?: string;
  fdSCIX?: string;
}

export interface GrassHouse {
  name: string;
  address: string;
  rewardToken: string;
}

export interface xALPACAv2Rewarder {
  name: string;
  address: string;
  rewardToken: string;
}
