const config = require("../config");
module.exports = {

    getInfoByIpfsUri: async function(uri) {
        let tokenCID = uri.split(":")[2];
        let response = await fetch(config.ipfsNodeUrl + tokenCID);
        return await response.json();
    },

    makeBatchRequest: function (calls, web3) {
        let batch = new web3.BatchRequest();
        let promises = calls.map(call => {
            return new Promise((res, rej) => {
                let req = call["method"].request(call["params"], (err, data) => {
                    if(err) rej(err);
                    else res(data)
                });
                batch.add(req)
            })
        })
        batch.execute()
        return Promise.all(promises)
    }
}
