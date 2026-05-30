const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const id = context.bindingData.id;

    try {
        const client = new CosmosClient({
            endpoint: process.env.COSMOS_ENDPOINT,
            key: process.env.COSMOS_KEY,
        });
        const container = client.database("kramDB").container("kramar");

        const { resource: kram } = await container.item(id, id).read();

        if (!kram) {
            context.res = { status: 404 };
            return;
        }

        context.res = {
            status: 200,
            body: {
                message: kram.message,
                trackId: kram.trackId || null
            }
        };
    } catch (err) {
        if (err && err.code === 404) {
            context.res = { status: 404 };
            return;
        }
        context.log("getKram error:", err && err.name, err && err.code, err && err.message);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                diag: {
                    where: 'getKram',
                    name: err && err.name,
                    code: err && err.code,
                    statusCode: err && err.statusCode,
                    message: ((err && err.message) || '').slice(0, 400),
                    hasEndpoint: !!process.env.COSMOS_ENDPOINT,
                    hasKey: !!process.env.COSMOS_KEY,
                    keyLen: (process.env.COSMOS_KEY || '').length,
                    endpointTail: (process.env.COSMOS_ENDPOINT || '').slice(-32)
                }
            }
        };
    }
};
