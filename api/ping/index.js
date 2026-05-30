module.exports = async function (context, req) {
    context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
            ok: true,
            node: process.version,
            hasEndpoint: !!process.env.COSMOS_ENDPOINT,
            hasKey: !!process.env.COSMOS_KEY
        }
    };
};
