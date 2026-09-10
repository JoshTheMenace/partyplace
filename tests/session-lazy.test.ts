import assert from 'node:assert/strict';
import test from 'node:test';
import { PartySession } from '../packages/party-client/src/session';

test('library browsing opens no socket; selecting a room connects and sends the queued request once', () => {
  const originals = ['WebSocket','location','sessionStorage'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  const sockets:FakeSocket[]=[];
  class FakeSocket {
    static OPEN=1;readyState=0;sent:Record<string,unknown>[]=[];onopen?:()=>void;onclose?:()=>void;
    constructor(public url:string){sockets.push(this);}
    send(raw:string){this.sent.push(JSON.parse(raw));}
    close(){this.readyState=3;this.onclose?.();}
  }
  Object.defineProperty(globalThis,'WebSocket',{configurable:true,value:FakeSocket});
  Object.defineProperty(globalThis,'location',{configurable:true,value:{protocol:'http:',host:'localhost:4360'}});
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>null,removeItem(){}}});
  const session=new PartySession({deferConnection:true});
  try {
    assert.equal(sockets.length,0);assert.equal(session.state.connection,'idle');
    session.join('room.create',{});assert.equal(sockets.length,1);assert.equal(sockets[0].url,'ws://localhost:4360/ws');
    sockets[0].readyState=1;sockets[0].onopen?.();
    assert.equal(sockets[0].sent.filter(v=>v.type==='room.create').length,1);
    assert.equal(session.state.connection,'connected');
    session.join('room.join',{code:'ABC234',name:'Retry'});
    assert.equal(sockets[0].readyState,3);assert.equal(sockets.length,2);
    sockets[1].readyState=1;sockets[1].onopen?.();
    assert.equal(sockets[1].sent.filter(v=>v.type==='room.join').length,1);
    assert.equal(sockets[1].sent.find(v=>v.type==='room.join')?.code,'ABC234');
  } finally {session.dispose();for(const [key,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
});
