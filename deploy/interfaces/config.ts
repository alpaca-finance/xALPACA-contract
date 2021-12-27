export interface Config {
  Timelock: string;
  FairLaunch: FairLaunch;
  Scientix: Scientix;
  Tokens: Tokens;
  xALPACA: string;
  ALPACAFeeder: string;
  GrassHouses: GrassHouse[];
  GrassHouseGateway: string;
}

export interface FairLaunch {
  address: string;
  deployedBlock: number;
  pools: Pool[];
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
  ALPACA: string;
  fdALPACA: string;
  SCIX: string;
  fdSCIX: string;
}

export interface GrassHouse {
  name: string;
  address: string;
  rewardToken: string;
}
