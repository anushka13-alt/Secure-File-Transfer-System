const express = require("express")
const cors = require("cors")
const crypto = require("crypto")
const { createClient } = require("redis")

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const PORT = 3000

const redisClient = createClient()

redisClient.on("error",(err)=>console.log("Redis Error",err))

async function connectRedis(){
 await redisClient.connect()
 console.log("Redis Connected")
}

connectRedis()


function generateKey(){
 return crypto.randomBytes(3).toString("hex").toUpperCase()
}


app.post("/session/create", async (req,res)=>{

 const key = generateKey()

 const session = {
  senderConnected:true,
  receiverConnected:false,
  data:null
 }

 await redisClient.set(
  key,
  JSON.stringify(session),
  { EX:300 }
 )

 res.json({sessionKey:key})
})

app.post("/session/join/:key", async (req,res)=>{

 const key = req.params.key

 const data = await redisClient.get(key)

 if(!data){
  return res.json({message:"Invalid key"})
 }

 let session = JSON.parse(data)

 session.receiverConnected = true

 await redisClient.set(key, JSON.stringify(session), {EX:300})

 res.json({message:"Receiver connected"})
})


app.get("/session/status/:key", async (req,res)=>{

 const key = req.params.key

 const data = await redisClient.get(key)

 if(!data){
  return res.json({status:"invalid"})
 }

 const session = JSON.parse(data)

 res.json({
  receiverConnected: session.receiverConnected
 })
})

app.post("/session/send/:key", async (req,res)=>{

 const key = req.params.key
 const { message } = req.body

 const data = await redisClient.get(key)

 if(!data){
  return res.json({message:"Invalid key"})
 }

 let session = JSON.parse(data)

 if(!session.receiverConnected){
  return res.json({message:"Receiver not connected"})
 }

 session.data = message

 await redisClient.set(key, JSON.stringify(session), {EX:300})

 res.json({message:"Data sent successfully"})
})

app.get("/session/receive/:key", async (req,res)=>{

 const key = req.params.key

 const data = await redisClient.get(key)

 if(!data){
  return res.json({message:"Invalid key"})
 }

 let session = JSON.parse(data)

 if(!session.data){
  return res.json({message:"Waiting for data"})
 }

 const message = session.data

 session.data = null

 await redisClient.set(key, JSON.stringify(session), {EX:300})

 res.json({data:message})
})

app.listen(PORT,()=>{
 console.log("Server running on port",PORT)
})