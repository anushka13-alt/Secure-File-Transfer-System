
#  Secure File Transfer System

This project is a simple implementation of a secure file transfer system built using a client-server model. The goal was to understand how files can be transferred safely over a network using encryption techniques.

Instead of sending data in plain text, this system ensures that files are encrypted before transmission and securely handled on the receiving end.

##  Why this project?

While learning about networking and cybersecurity, I wanted to build something practical that combines:

* Socket programming
* Encryption (RSA + AES)
* File handling
* Basic database usage

This project is the result of that exploration.



##  How it works 

1. The client connects to the server
2. If it's a new user, it gets registered
3. Keys are generated for secure communication
4. The file is encrypted before sending
5. The server receives and verifies the file
6. Data integrity is checked to make sure nothing is corrupted



##  Features

* Secure file transfer using encryption
* RSA for key exchange
* AES for file encryption
* Client-server communication using sockets
* Basic integrity check (CRC)
* Simple and understandable implementation


##  Tech Used

* **C++** → Client side
* **Python** → Server side
* **MySQL** → Data storage
* **Sockets (TCP)** → Communication
* **RSA & AES** → Encryption

---

##  Security Used

* RSA → for securely sharing keys
* AES → for encrypting files
* CRC → for checking file integrity

---

##  Limitations

* Not production-ready
* Basic implementation of security concepts
* No advanced authentication yet

---

##  Future Improvements

* Add login/authentication system
* Build a simple UI
* Improve security (TLS, better validation)
* Support larger file transfers

---

##  What I learned

* How encryption actually works in real systems
* Handling client-server communication
* Combining multiple technologies in one project
* Debugging real-world issues 

---

##  Contributing

Feel free to fork and improve this project. Suggestions are always welcome!

---

##  If you like it

Give it a star on GitHub — it helps!

---


