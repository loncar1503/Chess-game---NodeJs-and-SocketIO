//konektujemo sa socketIO
const socket = io();

const fetchData = (url, callback) => {
  //funkcija fetchData koristi fetch API za slanje HTTP zahteva i upravljanje odgovorom. Prima parametre: URL na koji se šalje HTTP zahtev i
  //callback: Funkcija koja se poziva kada se uspešno preuzmu podaci.
  fetch(url) //funkcija koja šalje HTTP GET zahtev na zadati url i vraća Promise objekat koji se može koristiti za rad sa odgovorom
    .then((res) => {
      if (!res.ok) {
        throw Error("Something went wrong!");
      }
      return res.json(); //Ako je odgovor uspešan, konvertuje odgovor u JSON format i vraća novi Promise koji se razrešava sa JSON podacima.
    })
    .then(callback) //Kada se JSON podaci dobiju, callback funkcija se poziva sa ovim podacima kao argumentom
    .catch((err) => console.log(err.message));
};

socket.on("error", (errorMessage) => {
  window.location.href = "http://localhost:5000/games?error=" + errorMessage;
});
