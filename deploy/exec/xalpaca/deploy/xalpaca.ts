
import { ethers} from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BEP20, BEP20__factory, XALPACA__factory, XALPACA } from "../../../../typechain";


const func: DeployFunction =  async function(hre: HardhatRuntimeEnvironment){
    // Deploy contract context
    // let ALPACA : BEP20

    // const BEP20 = (await ethers.getContractFactory("BEP20", (await ethers.getSigners())[0])) as BEP20__factory;
    // ALPACA = await BEP20.deploy("ALPACA", "ALPACA");

    // const XALPACA = (await ethers.getContractFactory(
    // "xALPACA",
    // (await ethers.getSigners())[0]
    // )) as XALPACA__factory;

    // const xAlpaca =  await XALPACA.deploy('0x354b3a11D5Ea2DA89405173977E271F58bE2897D');
    // console.log(xAlpaca)
    // console.log("✅ Done");

    // TESTING USING CONTRACT

    const [deployer,alice] = await ethers.getSigners()



    const xalpacaContractAddress: string = '0x35ad4f66ac64b964dff8f78e6d0a550c69d1bcdc'
    

    let xAlpacaAsAlice : XALPACA = XALPACA__factory.connect(xalpacaContractAddress,alice)
    console.log('xAlpacaAsAlice',xAlpacaAsAlice)
    
    

    console.log("✅ Done");



}

export default func;
func.tags = ["TestnetDeployXAlpaca"];
