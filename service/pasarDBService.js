let config = require('../config');
let MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
const config_test = require("../config_test");
config = config.curNetwork == 'testNet'? config_test : config;

module.exports = {
    getLastPasarOrderSyncHeight: async function (event, marketPlace = config.elastos.chainType, v1Event=null) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order_event');
            let doc = await collection.findOne({event, marketPlace, v1Event}, {sort:{blockNumber:-1}})
            if(doc) {
                return doc.blockNumber
            } else {
                if(marketPlace == config.ethereum.chainType) {
                    return config.ethereum.pasarContractDeploy;
                } else if(marketPlace == config.fusion.chainType) {
                    return config.fusion.pasarContractDeploy;
                } else if(v1Event) {
                    return config.elastos.pasarContractDeploy;
                } else {
                    return config.elastos.pasarV2ContractDeploy;
                }
            }
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    getLastOrderPlatformFeeSyncHeight: async function () {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order_platform_fee');
            let doc = await collection.findOne({}, {sort:{blockNumber:-1}})
            if(doc) {
                return doc.blockNumber
            } else {
                return config.upgradeBlock;
            }
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    updateOrInsert: async function (pasarOrder) {
        let {orderId, tokenId, baseToken, marketPlace, ...rest} = pasarOrder;
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order');
            await collection.updateOne({orderId, tokenId, baseToken, marketPlace}, {$set: rest}, {upsert: true});
            let checkData = await collection.findOne(pasarOrder);
            if(!checkData) {
                await this.updateOrInsert(pasarOrder);
            }
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    replaceDid: async function({address, did}) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_address_did');
            await collection.updateOne({address, "did.version": did.version, "did.did": did.did}, {$set: {did}}, {upsert: true});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    updateDid: async function({address, did}) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_address_did');
            await collection.updateOne({address}, {$set: {did}}, {upsert: true});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    insertOrderEvent: async function (orderEventDetail) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order_event');

            let length = await collection.find({tokenId: orderEventDetail.tokenId, event: orderEventDetail.event, baseToken: orderEventDetail.baseToken, marketPlace: orderEventDetail.marketPlace, blockNumber: orderEventDetail.blockNumber}).count();
            if(length == 0) {
                await collection.insertOne(orderEventDetail);
            }
        } catch (err) {
            throw new Error();
        } finally {
           await mongoClient.close();
        }
    },

    insertOrderPlatformFeeEvent: async function (orderEventDetail) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order_platform_fee');
            await collection.insertOne(orderEventDetail);
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    resultProject: {"_id": 0, orderId:1, orderType:1, orderState:1, tokenId: 1,blockNumber: 1, amount: 1,
        price: 1, endTime: 1, sellerAddr: 1, buyerAddr: 1, bids: 1, lastBidder: 1, filled:1, royaltyFee: 1,
        createTime: 1, updateTime: 1, lastBid: 1,sellerDid: 1, asset: "$token.asset", name: "$token.name",
        description: "$token.description", kind: "$token.kind", type: "$token.type", size: "$token.size",
        royalties: "$token.royalties",royaltyOwner: "$token.royaltyOwner", quantity: "$token.quantity",
        tokenDid: "$token.did", thumbnail: "$token.thumbnail", tokenCreateTime: "$token.createTime",
        tokenUpdateTime: "$token.updateTime", adult: "$token.adult", data: "$token.data", version: "$token.tokenJsonVersion"},

    allSaleOrders: async function(sortType, sort, pageNum, pageSize, adult) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order');

            let pipeline = [
                { $match: {orderState: "1"}},
                { $lookup: {from: "pasar_token", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                { $unwind: "$token"},
            ];

            let total
            if(adult !== undefined) {
                let pipeline2 = [
                    { $match: {orderState: "1"}},
                    { $lookup: {from: "pasar_token", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                    { $unwind: "$token"},
                    { $match: {"token.adult": adult}},
                    { $count: "total"}
                ];
                total = (await collection.aggregate(pipeline2).toArray())[0].total;

                pipeline.push({ $match: {"token.adult": adult}});
            } else {
                total = await collection.find({orderState: "1"}).count();
            }

            pipeline.push({ $project: this.resultProject});
            pipeline.push({ $sort: {[sortType]: sort}});

            if(pageNum !== undefined) {
                pipeline.push({ $skip: (pageNum - 1) * pageSize });
                pipeline.push({ $limit: pageSize });
            }

            let result = await collection.aggregate(pipeline).toArray();

            return {code: 200, message: 'success', data: {total, result}};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    searchSaleOrders: async function(searchType, key, adult) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order');

            let firstMatch = {}, match = {};
            if(adult !== undefined) {
                match["token.adult"] = adult;
            }

            if(searchType !== undefined) {
                if(searchType === 'ownerAddress') {
                    firstMatch["sellerAddr"] = key;
                } else if (searchType === 'tokenId'){
                    firstMatch["tokenId"] = key;
                } else if(searchType === 'name') {
                    match["token.name"] = {$regex: key, $options: 'i'};
                } else if(searchType === 'royaltyAddress') {
                    match["token.royaltyOwner"] = key;
                } else {
                    match["token.description"] = {$regex: key, $options: 'i'};
                }
            } else {
                match["$or"] = [{"tokenId": key}, {"token.royaltyOwner": key}, {"sellerAddr": key},
                    {"token.name": {$regex: key, $options: 'i'}}, {"token.description": {$regex: key, $options: 'i'}}];
            }

            firstMatch["orderState"] = "1";

            let pipeline = [
                { $match: firstMatch},
                { $lookup: {from: "pasar_token", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                { $unwind: "$token"},
            ];

            if(Object.keys(match).length !== 0) {
                pipeline.push({$match: match})
            }
            pipeline.push({$project: this.resultProject})
            pipeline.push({$sort: {blockNumber: -1}})

            let result = await collection.aggregate(pipeline).toArray();

            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    listPasarOrder: async function(pageNum=1, pageSize=10, blockNumber, endBlockNumber, orderState,sortType, sort, adult) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order');

            let latestBlockNumber = 0;
            if(sortType !== undefined && pageNum === 1) {
                latestBlockNumber = (await collection.findOne({}, {sort: {blockNumber: -1}})).blockNumber;
            }

            let match = {}

            let pipeline = [
                { $match: match},
                { $lookup: {from: "pasar_token", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                { $unwind: "$token"},
            ];

            if(orderState) {
                match["orderState"] = orderState;
            }

            if(blockNumber !== undefined) {
                match["blockNumber"] = {"$gte": blockNumber };
            }

            if(endBlockNumber !== undefined) {
                if(match.blockNumber === undefined) {
                    match["blockNumber"] = {"$lt": endBlockNumber };
                } else {
                    match.blockNumber["$lt"] = endBlockNumber;
                }
            }
            let total;
            if(adult !== undefined) {
                let pipeline2 = [
                    { $match: match},
                    { $lookup: {from: "pasar_token", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                    { $unwind: "$token"},
                    { $match: {"token.adult": adult}},
                    { $count: "total"}
                ];
                total = (await collection.aggregate(pipeline2).toArray())[0].total;

                pipeline.push({$match: {"token.adult": adult}});
            } else {
                total = await collection.find(match).count();
            }
            pipeline.push({ $project: this.resultProject });
            if(sortType === 'price') {
                pipeline.push({ $sort: {'priceNumber': sort}});
            } else {
                pipeline.push({ $sort: {[sortType]: sort}});
            }
            pipeline.push({ $skip: (pageNum - 1) * pageSize });
            pipeline.push({ $limit: pageSize });

            let result = await collection.aggregate(pipeline).toArray();
            let response = {code: 200, message: 'success', data: {total,latestBlockNumber, result}};
            return response;
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getDidListByAddresses: async function(addresses) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_address_did');
            return await collection.find({address: {$in: addresses}}).project({"_id": 0}).toArray();
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getDidByAddress: async function(address) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_address_did');
            let result =  await collection.findOne({address}, {"_id": 0, address: 1, did: 1});
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getWhitelist: async function(address) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_whitelist');
            let result =  await collection.find(address ? {address}: {}).project({"_id": 0}).toArray();
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    pasarOrderCount: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order');
            return await collection.find({}).count();
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    pasarOrderEventCount: async function(startBlock, endBlock) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order_event');
            return await collection.find({blockNumber: {$gte: startBlock, $lte: endBlock}}).count();
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getTokenBatch: async function(listId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token');
            let listToken = await collection.find({tokenId: {$in: listId}}).toArray();
            return listToken;
        } catch (err) {
            logger.error(err);
            return [];
        } finally {
            await mongoClient.close();
        }
    },

    createCollection: async function(data) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_collection');
            await collection.insertOne(data);
            return {code: 200, message: 'success'};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getCollectionList: async function(address, sortType) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        let sort = {};
        switch(sortType) {
            case 'latest': 
                sort = {createdTime: -1}
                break;
            default:
                break;
        }
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_collection');
            let list = await collection.find({ownerAddress: address}).sort(sort).toArray();
            return {code: 200, message: 'success', data: list};

        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getCollection: async function(id) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_collection');
            let data = await collection.findOne({_id: ObjectID(id)});
            data.tokens = await this.getTokenBatch(collection.tokenIds);
            return {code: 200, message: 'success', data: data};

        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
}
