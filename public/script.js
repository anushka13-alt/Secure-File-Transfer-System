let currentKey = ""

async function createSession(){

 const res = await fetch("/session/create",{
  method:"POST"
 })

 const data = await res.json()

 currentKey = data.sessionKey

 document.getElementById("key").innerText =
 "Session Key: " + currentKey

 checkReceiver()

}

async function checkReceiver(){

 setInterval(async ()=>{

  if(!currentKey) return

  const res = await fetch("/session/status/"+currentKey)
  const data = await res.json()

  if(data.receiverConnected){
   document.getElementById("status").innerText =
   "Receiver connected"
  }

 },3000)

}

async function sendData(){

 const message = document.getElementById("message").value

 const res = await fetch("/session/send/"+currentKey,{
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  body:JSON.stringify({
   message:message
  })
 })

 const data = await res.json()

 alert(data.message)

}

async function joinSession(){

 const key = document.getElementById("joinKey").value

 currentKey = key

 const res = await fetch("/session/join/"+key,{
  method:"POST"
 })

 const data = await res.json()

 document.getElementById("joinStatus").innerText =
 data.message

}

async function receiveData(){

 const res = await fetch("/session/receive/"+currentKey)

 const data = await res.json()

 document.getElementById("received").innerText =
 data.data || data.message

}