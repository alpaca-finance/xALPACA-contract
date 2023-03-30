import { Timelock, Timelock__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { BigNumber, BigNumberish, ethers, Overrides } from "ethers";
import { TimelockEntity } from "../../../entities";
import { getConfigByChainId } from "../../../entities/config";
import { compareAddress } from "../../address";
import { GnosisSafeMultiSigService } from "../../multisig/gnosis-safe";

export class MaybeMultisigTimelock {
  private chainId: number;
  private timelock: Timelock;
  private signer: ethers.Signer;
  private multiSig: GnosisSafeMultiSigService;

  constructor(_chainId: number, _signer: ethers.Signer) {
    if (_chainId != 56 && _chainId != 250) {
      throw new Error("MaybeMultisigTimelock: ChainId not supported");
    }

    const config = getConfigByChainId(_chainId);

    this.chainId = _chainId;
    this.timelock = Timelock__factory.connect(config.Timelock, _signer);
    this.multiSig = new GnosisSafeMultiSigService(this.chainId, config.OpMultiSig, _signer);
    this.signer = _signer;
  }

  async queueTransaction(
    info: string,
    target: string,
    value: string,
    signature: string,
    paramTypes: Array<string>,
    params: Array<any>,
    eta: BigNumberish,
    overrides?: Overrides
  ): Promise<TimelockEntity.Transaction> {
    const etaBN = BigNumber.from(eta);
    const signerAddress = await this.signer.getAddress();
    const timelockAdmin = await this.timelock.admin();

    let txHash = "";
    if (compareAddress(timelockAdmin, signerAddress)) {
      console.log(`> Queue tx for: ${info}`);
      const queueTx = await this.timelock.queueTransaction(
        target,
        value,
        signature,
        ethers.utils.defaultAbiCoder.encode(paramTypes, params),
        eta,
        overrides
      );
      await queueTx.wait();
      txHash = queueTx.hash;
    } else if (compareAddress(timelockAdmin, this.multiSig.getAddress())) {
      console.log(`> Propose tx for: ${info}`);
      info = `MultiSign: ${info}`;
      txHash = await this.multiSig.proposeTransaction(
        this.timelock.address,
        "0",
        this.timelock.interface.encodeFunctionData("queueTransaction", [
          target,
          value,
          signature,
          ethers.utils.defaultAbiCoder.encode(paramTypes, params),
          eta,
        ])
      );
    } else {
      throw new Error("MaybeMultisigTimelock: Unknown admin");
    }
    const paramTypesStr = paramTypes.map((p) => `'${p}'`);
    const paramsStr = params.map((p) => {
      if (Array.isArray(p)) {
        const vauleWithQuote = p.map((p) => {
          if (typeof p === "string") return `'${p}'`;
          return JSON.stringify(p);
        });
        return `[${vauleWithQuote}]`;
      }

      if (typeof p === "string") {
        return `'${p}'`;
      }

      return p;
    });

    const executionTx = `await timelock.executeTransaction('${target}', '${value}', '${signature}', ethers.utils.defaultAbiCoder.encode([${paramTypesStr}], [${paramsStr}]), '${eta}')`;
    console.log(`> ⛓ Queued at: ${txHash}`);
    return {
      info: info,
      chainId: this.chainId,
      queuedAt: txHash,
      executedAt: "",
      executionTransaction: executionTx,
      target,
      value,
      signature,
      paramTypes,
      params,
      eta: etaBN.toString(),
    };
  }

  async executeTransaction(
    info: string,
    queuedAt: string,
    executionTx: string,
    target: string,
    value: string,
    signature: string,
    paramTypes: Array<string>,
    params: Array<any>,
    eta: BigNumberish,
    overrides?: Overrides
  ): Promise<TimelockEntity.Transaction> {
    console.log(`> Execute tx for: ${info}`);
    const etaBN = BigNumber.from(eta);
    const signerAddress = await this.signer.getAddress();
    const timelockAdmin = await this.timelock.admin();

    let txHash = "";
    if (compareAddress(timelockAdmin, signerAddress)) {
      const queueTx = await this.timelock.executeTransaction(
        target,
        value,
        signature,
        ethers.utils.defaultAbiCoder.encode(paramTypes, params),
        etaBN,
        overrides
      );
      await queueTx.wait();
      txHash = queueTx.hash;
      console.log("> ⛓ Executed at:", txHash);
    } else if (compareAddress(timelockAdmin, this.multiSig.getAddress())) {
      txHash = await this.multiSig.proposeTransaction(
        this.timelock.address,
        "0",
        this.timelock.interface.encodeFunctionData("executeTransaction", [
          target,
          value,
          signature,
          ethers.utils.defaultAbiCoder.encode(paramTypes, params),
          eta,
        ])
      );
      console.log("> Proposed at:", txHash);
    }
    console.log(`> Done.`);

    return {
      info: info,
      chainId: this.chainId,
      queuedAt: queuedAt,
      executedAt: txHash,
      executionTransaction: executionTx,
      target,
      value,
      signature,
      paramTypes,
      params,
      eta: etaBN.toString(),
    };
  }
}
