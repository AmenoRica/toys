import {physicsService} from './physics-service.js';
const handle=physicsService((message,transfer=[])=>self.postMessage(message,transfer));
self.onmessage=({data})=>handle(data);
