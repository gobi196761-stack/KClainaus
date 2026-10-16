let generatedCode = "";

function sendCode() {
    const email = document.getElementById('email').value;
    if (!email) return alert("Syötä sähköposti");
    
    generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Käytetään oikeaa Service ID:tä
    emailjs.send('service_wf86l3j', 'template_7moek5d', { to_email: email, koodi: generatedCode })
        .then(() => {
            document.getElementById('codeArea').style.display = 'block';
            alert("Koodi lähetetty!");
        })
        .catch(err => alert("Virhe: " + JSON.stringify(err)));
}

function verifyCode() {
    const userCode = document.getElementById('code').value;
    if (userCode === generatedCode) {
        window.location.href = 'kclainaus.html';
    } else {
        alert("Virheellinen koodi!");
    }
}
