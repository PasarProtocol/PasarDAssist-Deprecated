/**
    sync all events on the ethereum network
*/

const { config, DB_SYNC} = require("./utils");
const { syncEthRegisterCollection, transferEthCustomCollection } = require('./syncEthImportCollection');
const { syncPasarCollection, transferSingleEth, transferBatchEth, royaltyFeeEth, orderPriceChangedEth, orderForSaleEth, orderForAuctionEth, orderFilledEth, orderCanceledEth, orderBidEth, orderDIDURI } = require('./syncEthPasarCollection');

let stickerDBService = require('../../service/stickerDBService');
let currentStep = 0;
let i = 0;
let totalCount;
const importDataInDB = async (marketPlace) => {
    console.log("======= Start Importing Data ==========")
    
    let step = 100;
    
    totalCount = await stickerDBService.getCountSyncTemp(DB_SYNC);
    console.log(totalCount);

    let totalStep = Math.ceil(totalCount/step);
    
    try {
        while(currentStep < totalStep) {
            let listDoc = await stickerDBService.getSyncTemp(DB_SYNC, currentStep, step);
            if(listDoc == null) {
                continue;
            }
            for(; i < listDoc.length; i++) {
                let cell = listDoc[i];
                switch(cell.eventType) {
                    case "TransferSingle":
                        if(cell.baseToken == config.ethereum.stickerContract) {
                            await transferSingleEth(cell.eventData, marketPlace);
                        } else {
                            await transferEthCustomCollection(cell.eventData, cell.baseToken, marketPlace);
                        }
                        break;
                    case "Transfer":
                        if(cell.baseToken == config.ethereum.stickerContract) {
                            await transferSingleEth(cell.eventData, marketPlace);
                        } else {
                            await transferEthCustomCollection(cell.eventData, cell.baseToken, marketPlace);
                        }
                        break;
                    case "TransferBatch":
                        if(cell.baseToken == config.ethereum.stickerContract) {
                            await transferBatchEth(cell.eventData, marketPlace);
                        }
                        break;
                    case "RoyaltyFee":
                        if(cell.baseToken == config.ethereum.stickerContract) {
                            await royaltyFeeEth(cell.eventData, marketPlace);
                        }
                        break;
                    case "OrderForSale":
                        if(cell.baseToken == config.ethereum.pasarContract) {
                            await orderForSaleEth(cell.eventData, marketPlace);
                        }
                        break;
                    case "OrderForAuction":
                        if(cell.baseToken == config.ethereum.pasarContract) {
                            await orderForAuctionEth(cell.eventData, marketPlace);
                        }
                        break;
                    case "OrderBid":
                        if(cell.baseToken == config.ethereum.pasarContract) {
                            await orderBidEth(cell.eventData, marketPlace);
                        }
                        break;
                    case "OrderPriceChanged":
                        if(cell.baseToken == config.ethereum.pasarContract) {
                            await orderPriceChangedEth(cell.eventData, marketPlace);
                        }
                        break;
                    case "OrderCanceled":
                        if(cell.baseToken == config.ethereum.pasarContract) {
                            await orderCanceledEth(cell.eventData, marketPlace);
                        }
                        break;
                    case "OrderFilled":
                        if(cell.baseToken == config.ethereum.pasarContract) {
                            await orderFilledEth(cell.eventData, marketPlace);
                        }
                        break;
                    case "OrderDidURI":
                        if(cell.baseToken == config.ethereum.pasarContract) {
                            await orderDIDURI(cell.eventData, marketPlace);
                        }
                        break;
                } 
                logger.info("Current Step: " + (currentStep * step + i) + " / " + totalCount + " - " + cell.blockNumber + " : " + cell.eventType);
            }
            currentStep++;
            i = 0;
        }
        console.log("======= End Importing Data ==========")
    } catch(err) {
        logger.info("Error happened Step: " + (currentStep * step + i) + " / " + totalCount);
        logger.info(err);
        if(i == step - 1) {
            currentStep++
        } else {
            i++;
        }
        await importDataInDB(marketPlace);
    }
}

if (require.main == module) {
    (async ()=> {
        await syncEthRegisterCollection(config.ethereum.chainType);
        await syncPasarCollection();
        await importDataInDB(config.ethereum.chainType);
    })();
}
