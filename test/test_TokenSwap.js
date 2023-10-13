const {expect} = require("chai");
const {ethers, network} = require("hardhat");

const {abi} = require("../artifacts/contracts/interfaces/IERC20.sol/IERC20.json");

const provider = waffle.provider;

describe("TokenSwap Contract", () => {
    const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const DAI_WHALE = "0x60faae176336dab62e284fe19b885b095d29fb7f";
    const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";

    let DAI_INSTANCE, WBTC_INSTANCE, WBTC_DECIMALS, DAI_DECIMALS;
    let TOKEN_SWAP, AMOUNT_IN, myAccount, initial_myAccount_wbtc, final_myAccount_wbtc;

    before(async () => {
        [myAccount] = await ethers.getSigners();

        DAI_INSTANCE = new ethers.Contract(DAI, abi, provider);
        WBTC_INSTANCE = new ethers.Contract(WBTC, abi, provider);
        
        WBTC_DECIMALS = await WBTC_INSTANCE.decimals();
        DAI_DECIMALS = await DAI_INSTANCE.decimals();

        let amountIn = "1000";
        console.log(`amountIn: ${amountIn} DAI`);
        AMOUNT_IN = ethers.utils.parseUnits(amountIn, DAI_DECIMALS);

        initial_myAccount_wbtc = await WBTC_INSTANCE.balanceOf(myAccount.address);

        //contract deployment
        const tokenSwap = await ethers.getContractFactory("TokenSwap");
        TOKEN_SWAP= await tokenSwap.deploy();
        await TOKEN_SWAP.deployed();
    });
    
    it("should ensure whale has sufficient ETH", async () => {
        const whale_ETH = await provider.getBalance(DAI_WHALE);
        expect(whale_ETH).to.be.gte(ethers.utils.parseEther("1"));
    });

    it("should ensure whale has sufficient DAI", async () => {
        const whale_DAI = await DAI_INSTANCE.balanceOf(DAI_WHALE);
        expect(whale_DAI).to.be.gte(AMOUNT_IN);
    });
    
    it("should deploy TokenSwap contract", async () => {
        expect(TOKEN_SWAP.address).to.exist;
    });

    describe("Swap execution", () => {
        it("should swap tokens", async () => {
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [DAI_WHALE],
            });

            const whale_signer = await ethers.getSigner(DAI_WHALE);
            await DAI_INSTANCE.connect(whale_signer).approve(TOKEN_SWAP.address, AMOUNT_IN);

            const amountOutMin = await TOKEN_SWAP.connect(whale_signer).getAmountOutMin(DAI, WBTC, AMOUNT_IN);

            await TOKEN_SWAP.connect(whale_signer).swap(DAI, WBTC, AMOUNT_IN, amountOutMin, myAccount.address)

            await network.provider.request({
                method: "hardhat_stopImpersonatingAccount",
                params: [DAI_WHALE],
            });

            final_myAccount_wbtc = await WBTC_INSTANCE.balanceOf(myAccount.address);

            const amountReceived = final_myAccount_wbtc - initial_myAccount_wbtc;
            console.log(`amountReceived: ${ethers.utils.formatUnits(amountReceived, WBTC_DECIMALS)} WBTC`);
            
            expect(amountReceived).to.equal(amountOutMin);
        });
    });
});