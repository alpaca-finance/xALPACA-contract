
import { BigNumber } from "ethers";
import { ethers} from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BEP20, BEP20__factory, XALPACA__factory, XALPACA } from "../../../../typechain";


const func: DeployFunction =  async function(hre: HardhatRuntimeEnvironment){
    let ALPACA : BEP20

    const BEP20 = (await ethers.getContractFactory("BEP20", (await ethers.getSigners())[0])) as BEP20__factory;
    ALPACA = await BEP20.deploy("ALPACA", "ALPACA");

    const XALPACA = (await ethers.getContractFactory(
    "xALPACA",
    (await ethers.getSigners())[0]
    )) as XALPACA__factory;

    console.log('ALPACA address',ALPACA.address)

    const xAlpaca =  await XALPACA.deploy(ALPACA.address,{  gasLimit: 500000});
   
    console.log('xAlpaca address',xAlpaca.address)
    console.log("✅ Done");
}

export default func;
func.tags = ["TestnetDeployXAlpaca"];
