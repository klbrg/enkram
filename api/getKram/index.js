const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
});

const container = client.database("kramDB").container("kramar");

module.exports = async function (context, req) {
    const id = context.bindingData.id;

    try {
        const { resource } = await container.item(id, id).read();
        if (!resource) throw new Error("Not found");

        // Radera kramen efter att den visats
        await container.item(id, id).delete();

        context.res = {
            status: 200,
            body: { message: resource.message, createdAt: resource.createdAt }
        };
    } catch (err) {
        context.res = {
            status: 404,
            body: "Den här kramen finns inte längre."
        };
    }
};
