
import { BigNumber } from "ethers";
import { ethers,upgrades} from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BEP20, BEP20__factory, XALPACA__factory, XALPACA } from "../../../../typechain";


const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment){
    // let ALPACA : BEP20

    // const BEP20 = (await ethers.getContractFactory("BEP20", (await ethers.getSigners())[0])) as BEP20__factory;
    // ALPACA = await BEP20.deploy("ALPACA", "ALPACA");

    const alpacaAddress = '0x616f8604955B661920041E618A2a59cD1fF1B911'
    
    const XALPACA = (await ethers.getContractFactory(
        "xALPACA",
        (await ethers.getSigners())[0]
        )) as XALPACA__factory;
        console.log('ALPACA address',alpacaAddress)
        const xALPACA = await upgrades.deployProxy(XALPACA,[alpacaAddress]) as XALPACA

    console.log('xAlpaca address',xALPACA.address)
    console.log("✅ Done");
}

export default func;
func.tags = ["TestnetDeployXAlpaca"];
