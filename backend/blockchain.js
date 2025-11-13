const Web3 = require("web3");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const web3 = new Web3(process.env.RPC_URL);
const account = web3.eth.accounts.wallet.add(process.env.CHAIN_PRIVATE_KEY);

const contractJsonPath = path.join(__dirname, "..", "contracts", "MedVaultRegistry.json");
// Assume you compiled the contract and saved the ABI as MedVaultRegistry.json
const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, "utf8"));
const contract = new web3.eth.Contract(contractJson.abi, process.env.CONTRACT_ADDRESS);

async function storeRecordHashOnChain(hashHex) {
  const hashBytes32 = "0x" + hashHex;
  const tx = contract.methods.storeRecord(hashBytes32);
  const gas = await tx.estimateGas({ from: account.address });
  const receipt = await tx.send({ from: account.address, gas });
  return receipt.transactionHash;
}

async function approveDoctor(hashHex, doctorAddress) {
  const hashBytes32 = "0x" + hashHex;
  const tx = contract.methods.approveDoctor(hashBytes32, doctorAddress);
  const gas = await tx.estimateGas({ from: account.address });
  const receipt = await tx.send({ from: account.address, gas });
  return receipt.transactionHash;
}

async function hasAccess(hashHex, userAddress) {
  const hashBytes32 = "0x" + hashHex;
  return contract.methods.hasAccess(hashBytes32, userAddress).call();
}

module.exports = { storeRecordHashOnChain, approveDoctor, hasAccess };
