const { KiteConnect } = require('kiteconnect');

const kite = new KiteConnect({
    api_key: "noklwyic93dx9c5e",
    access_token: "5ZtuA0hjHT22CtAq0O0Ng1xw4N7pxfj3"
});

const ce_tag = "1_GW0633_CE";
const pe_tag = "1_GW0633_PE";

const tag_map = {
    [ce_tag]: 0,
    [pe_tag]: 0
}

// // async function verifyBuy(){
// //     const orderbook = await kite.getOrders();
// //     let sample = orderbook.slice(0,4);
// //     sample.forEach(order => {
// //         console.log(order);
// //         // console.log(order.order_id, order.exchange_order_id, order.parent_order_id, order.quantity, order.status, order.tag, order.tags);
// //     });
// //     for(let order of orderbook){
// //         if(order.tag !== null && order.transaction_type === 'BUY'){
// //             if(order.tag === ce_tag){
// //                 tag_map[ce_tag]++;
// //             }
// //             else if(order.tag === pe_tag){
// //                 tag_map[pe_tag]++;
// //             }
// //         }
// //     }

// //     if(tag_map[ce_tag] > 0 && tag_map[pe_tag] > 0){
// //         return true;
// //     }
// //     else{
// //         return false;
// //     }
// // }

// // if(verifyBuy()){
// //     console.log("Buy verified");
// // }
// // else{
// //     console.log("Buy not verified");
// // }
// }

// kite.getOrderHistory(260127150685799)
// .then(result => {
//     // result.filter(item => item.status === "COMPLETE").forEach(item => {
//     //     console.log(item.average_price, item.filled_quantity);
//     // });
//     // console.log(result.length);
//     console.log(result);
// })
// .catch(error => {
//     console.log(error);
// });

async function getOrderDetails(orderId){
    if(!kite){
        console.log('Paper trading mode - simulating order details');
        return {success: false, error: 'Paper trading mode - cannot get order details'};
    }

    const orderDetails = await kite.getOrderHistory(orderId);
    let completeOrder = orderDetails.filter(item => item.status === "COMPLETE").at(-1);
    if(completeOrder){
        return {success: true, data: {
            order_id: completeOrder.order_id,
            symbol: completeOrder.tradingsymbol,
            token: completeOrder.instrument_token.toString(),
            last_price: completeOrder.average_price,
            quantity: completeOrder.filled_quantity,
            tag: completeOrder.tag,
            tags: JSON.stringify(completeOrder.tags),
            status: completeOrder.status
        }}
    }
    else if(orderDetails.length > 0){
        let lastOrder = orderDetails.at(-1);
        return {success: true, data: {
            order_id: lastOrder.order_id,
            symbol: lastOrder.tradingsymbol,
            token: lastOrder.instrument_token.toString(),
            last_price: 0,
            quantity: 0,
            tag: lastOrder.tag,
            tags: JSON.stringify(lastOrder.tags),
            status: lastOrder.status
        }}
    }
    else {
        return {success: false, data: {
            message: 'NO_ORDER_FOUND'}
        };
    }

}

async function getOrdersByTag(tag){
    if(!kite){
        console.log('Paper trading mode - simulating order details');
        return {success: false, error: 'Paper trading mode - cannot get order details'};
    }

    const orders = await kite.getOrders();
    let filteredOrders = orders.filter(order => order.tag === tag);
    if (filteredOrders.length > 0){
        return {success: true, data: filteredOrders.map(order => ({
            order_id: order.order_id,
            symbol: order.tradingsymbol,
            token: order.instrument_token.toString(),
            last_price: order.average_price,
            quantity: order.filled_quantity,
            tag: order.tag,
            tags: JSON.stringify(order.tags),
            status: order.status
        }))};
    }
    else {
        return {success: false, data: {
            message: 'NO_ORDERS_FOUND'
        }};
    }
}

async function getOrdersByInstrumentToken(instrumentToken){
    if(!kite){
        console.log('Paper trading mode - simulating order details');
        return {success: false, error: 'Paper trading mode - cannot get order details'};
    }

    const orders = await kite.getOrders();
    let filteredOrders = orders.filter(order => order.instrument_token === parseInt(instrumentToken));
    if (filteredOrders.length > 0){
        return {success: true, data: filteredOrders.map(order => ({
            order_id: order.order_id,
            symbol: order.tradingsymbol,
            token: order.instrument_token.toString(),
            last_price: order.average_price,
            quantity: order.filled_quantity,
            tag: order.tag,
            tags: JSON.stringify(order.tags),
            status: order.status
        }))};
    }
    else {
        return {success: false, data: {
            message: 'NO_ORDERS_FOUND'
        }};
    }
}

// getOrdersByTag("ce")
// .then(result => {
//     console.log(result);
// })
// .catch(error => {
//     console.log(error);
// });

// getOrderDetails(260127150685799)
// .then(result => {
//     console.log(result);
// })
// .catch(error => {
//     console.log(error);
// });

// getOrdersByInstrumentToken("15017730")
// .then(result => {
//     console.log(result);
// })
// .catch(error => {
//     console.log(error);
// });