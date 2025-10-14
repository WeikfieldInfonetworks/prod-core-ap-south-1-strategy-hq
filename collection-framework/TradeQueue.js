class TradeQueue {
    constructor() {
        this.queue = [];
        this.length = 0;
    }

    enqueue(trade){
        this.queue.push(trade);
        this.length++;
    }

    dequeue(){
        if(this.length === 0){
            return null;
        }
        this.length--;
        return this.queue.shift();
    }

    peek(){
        if(this.length === 0){
            return null;
        }
        return this.queue[0];
    }
    
    isEmpty(){
        return this.length === 0;
    }

    size(){
        return this.length;
    }
    
    clear(){
        this.queue = [];
        this.length = 0;
    }

    toArray(){
        return this.queue;
    }
}