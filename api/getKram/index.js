const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
});

const container = client.database("kramDB").container("kramar");

module.exports = async function (context, req) {
    const id = context.bindingData.id;

    try {
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
        context.log("Fel vid hämtning:", err.message);
        context.res = { status: 500 };
    }
};
