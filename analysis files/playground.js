const { KiteConnect } = require('kiteconnect');

const kite = new KiteConnect({
    api_key: "noklwyic93dx9c5e",
    access_token: "5ZtuA0hjHT22CtAq0O0Ng1xw4N7pxfj3"
});

{
// const ce_tag = "1_GW0633_CE";
// const pe_tag = "1_GW0633_PE";

// const tag_map = {
//     [ce_tag]: 0,
//     [pe_tag]: 0
// }

// async function verifyBuy(){
//     const orderbook = await kite.getOrders();
//     for(let order of orderbook){
//         if(order.tag !== null && order.transaction_type === 'BUY'){
//             if(order.tag === ce_tag){
//                 tag_map[ce_tag]++;
//             }
//             else if(order.tag === pe_tag){
//                 tag_map[pe_tag]++;
//             }
//         }
//     }

//     if(tag_map[ce_tag] > 0 && tag_map[pe_tag] > 0){
//         return true;
//     }
//     else{
//         return false;
//     }
// }

// if(verifyBuy()){
//     console.log("Buy verified");
// }
// else{
//     console.log("Buy not verified");
// }
}

