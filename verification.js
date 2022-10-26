const { ethers } = require("ethers");
const fs = require('fs');

function sign(signer, data, signatureData) {
    let signArgs = JSON.parse(JSON.stringify(signatureData));
    signArgs[1] = { KYCVerification: signArgs[1].KYCVerification };
    // Shim for the fact ethers.js will change this functions names in the future
    if (signer.signTypedData) {
        return signer.signTypedData(...signArgs, data);
    } else {
        return signer._signTypedData(...signArgs, data);
    }
}

function getSignature(signer, participant, ptype, kycHash, signatureData) {
    let data = {
        participantType: ptype,
        participant: participant,
        kyc: kycHash,
        nonce: 0
    }
    return sign(signer, data, signatureData);
}

if (require.main === module) {
    (async () => {

        const body = process.env.BODY;
        const WEAVR_ADDRESS = process.env.WEAVR_ADDRESS;
        const PROVIDER = process.env.PROVIDER;
        const PRIVATE_KEY = process.env.PRIVATE_KEY;

        const provider = ethers.providers.JsonRpcProvider(PROVIDER);
        const signer = new ethers.Wallet(PRIVATE_KEY, provider);
        const response = JSON.parse(body);
        console.log(response);
        const PARTICIPANT_ID = response['applicantId'];
        const PARTICIPANT = "0x" + response['externalUserId'];
        const status = response['reviewResult']['reviewAnswer'];

        const abi = JSON.parse(fs.readFileSync('weavr.json', 'utf8'));
        const weavr = new ethers.Contract(WEAVR_ADDRESS, abi, signer);

        if(status === "GREEN"){


            const kycHash = ethers.utils.id(PARTICIPANT_ID);


            let signatureData = [
                {
                    name: "Weavr Protocol",
                    version: "1",
                    chainId: 42161,
                    verifyingContract: WEAVR_ADDRESS
                },
                {
                    KYCVerification: [
                        {type: "uint8", name: "participantType"},
                        {type: "address", name: "participant"},
                        {type: "bytes32", name: "kyc"},
                        {type: "uint256", name: "nonce"}
                    ]
                }
            ];
            const ptype = 6;
            const signature = getSignature(signer, PARTICIPANT, ptype, kycHash, signatureData);
            const tx = await (await weavr.approve(ptype, PARTICIPANT, kycHash, signature, {gasLimit: 1000000})).wait();
            console.log("Transaction receipt");
            console.log(tx);
        } else {
            throw new Error("Not verified, reverting...");
        }
    })().catch(error => {
        console.log(error);
        process.exit(1);
    });
}