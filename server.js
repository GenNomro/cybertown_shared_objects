const express = require('express');

const app = express();

const http = require('http').createServer(app);

const io = require('socket.io')(http);


app.use(express.static("public"));



app.get('/', (req, res) => {
  res.send('Hello Express app!')
});

let AVATARS = new Map();

io.on('connection', async function(socket){
  console.log('a user connected');
  AVATARS.set(socket, {pos: [0, 0, 0], rot: [0, 1, 0, 0]});
  socket.on("AV", function(msg) {
    msg.id = socket.id;
    console.log(msg);
    console.log(AVATARS.get(socket).room);
    if(AVATARS.get(socket) && AVATARS.get(socket).room) {
      socket.to(AVATARS.get(socket).room).emit("AV", msg);
    }
    if(AVATARS.get(socket)) {
      if(msg.pos) {
        AVATARS.get(socket).pos = msg.pos;
      }
      if(msg.rot) {
        AVATARS.get(socket).rot = msg.rot;
      }
    }
  });
  let initDetail;
  let ack; 
  try {
    [initDetail, ack] = await new Promise((resolve, reject) => { socket.on("JOIN", (data, ack) => { resolve([data, ack]); }); setTimeout(() => reject("Timed out waiting for JOIN"), 10000); });
  } catch(e) {
    console.error(e);
    return;
  }
  for(let [other_socket, av] of AVATARS) {
    if(AVATARS.get(other_socket).room === initDetail.room) {
      socket.emit("AV:new", {id: other_socket.id, avatar: av.avatar});
      socket.emit("AV", {id: other_socket.id, pos: av.pos, rot: av.rot});
      
      other_socket.emit("AV:new", {id: socket.id, avatar: initDetail.avatar});
    }
  }
  console.log(AVATARS);
  AVATARS.get(socket).avatar = initDetail.avatar;
  AVATARS.get(socket).room = initDetail.room;
  socket.join(initDetail.room);
  socket.on("SE", function(msg) {
    console.log(msg);
    io.to(AVATARS.get(socket).room).emit("SE", msg);
  });
  socket.on("CHAT", function(chatdata) {
    if(!chatdata || !chatdata.msg || typeof chatdata.msg !== "string") return;
    console.log(chatdata);
    if(AVATARS.get(socket).room) {
      io.to(AVATARS.get(socket).room).emit("CHAT", {id: socket.id, msg: chatdata.msg});
    }
  });
  socket.on("disconnect", function() {
    io.to(AVATARS.get(socket).room).emit("AV:del", socket.id);
    AVATARS.delete(socket);
  });
  ack(); // Acknolwedges to Client's JOIN that server is initialized
});


http.listen(process.env.PORT || 8000);