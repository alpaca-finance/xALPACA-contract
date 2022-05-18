import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";

export async function getDeployer(): Promise<SignerWithAddress> {
  const defaultDeployer = (await ethers.getSigners())[0];

  if (isFork(network.name)) {
    const provider = ethers.getDefaultProvider(process.env.FORK_RPC) as JsonRpcProvider;
    const signer = provider.getSigner(process.env.DEPLOYER_ADDRESS);
    const mainnetForkDeployer = await SignerWithAddress.create(signer);
    return mainnetForkDeployer;
  }

  return defaultDeployer;
}

export function isFork(networkName: string) {
  switch (networkName) {
    case "mainnetfork":
    case "fantom_mainnetfork":
      return true;
    default:
      return false;
  }
}
