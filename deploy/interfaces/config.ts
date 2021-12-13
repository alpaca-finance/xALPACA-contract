export interface Config {
  Timelock: string;
  FairLaunch: FairLaunch;
  Tokens: Tokens;
  xALPACA: string;
  ALPACAFeeder: string;
  PROXYTOKEN: string;
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
}

export interface GrassHouse {
  name: "";
  address: "";
  rewardToken: "";
}
