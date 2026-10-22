// Yhteiset apufunktiot palvelinfunktioille (alaviivalla alkava tiedosto ei ole Vercelissä reitti).
//
// Ympäristömuuttujat (Vercel → Settings → Environment Variables):
//   KC_SALAISUUS               pitkä satunnainen merkkijono tunnisteiden allekirjoitukseen
//   EMAILJS_PRIVATE_KEY        EmailJS → Account → API keys → Private Key
//   EMAILJS_PUBLIC_KEY         (valinnainen) EmailJS:n julkinen avain
//   FIREBASE_SERVICE_ACCOUNT   Firebase-palvelutilin avaintiedoston JSON-sisältö
const crypto = require('crypto');

const EMAILJS_SERVICE = 'service_wf86l3j';
const KOODI_TEMPLATE = 'template_7moek5d';
const VAHVISTUS_TEMPLATE = 'template_c08r5lr';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'DnLC7GQCglOezkCfw';
const DATABASE_URL = 'https://kclainaus-default-rtdb.europe-west1.firebasedatabase.app';

function salaisuus() {
    const s = process.env.KC_SALAISUUS;
    if (!s || s.length < 32) throw new Error('KC_SALAISUUS puuttuu tai on liian lyhyt');
    return s;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// Allekirjoitettu tunniste: base64url(JSON).base64url(HMAC). Vanhenee kentän `exp` (ms) mukaan.
function allekirjoita(sisalto) {
    const osa = b64url(JSON.stringify(sisalto));
    const mac = crypto.createHmac('sha256', salaisuus()).update(osa).digest();
    return `${osa}.${b64url(mac)}`;
}

function tarkista(tunniste, tyyppi) {
    if (typeof tunniste !== 'string' || !tunniste.includes('.')) return null;
    const [osa, mac] = tunniste.split('.');
    const odotettu = crypto.createHmac('sha256', salaisuus()).update(osa).digest();
    const annettu = Buffer.from(mac, 'base64url');
    if (annettu.length !== odotettu.length || !crypto.timingSafeEqual(annettu, odotettu)) return null;
    let sisalto;
    try { sisalto = JSON.parse(Buffer.from(osa, 'base64url').toString('utf8')); } catch { return null; }
    if (sisalto.tyyppi !== tyyppi || !(sisalto.exp > Date.now())) return null;
    return sisalto;
}

// Koodista tallennetaan tunnisteeseen vain avaimellinen tiiviste: sitä ei voi arvata ilman salaisuutta.
const koodinTiiviste = (koodi, email) =>
    crypto.createHmac('sha256', salaisuus()).update(`koodi:${email}:${koodi}`).digest('base64url');

function samaKoodi(koodi, email, tiiviste) {
    const a = Buffer.from(koodinTiiviste(String(koodi || '').trim(), email));
    const b = Buffer.from(String(tiiviste));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const uusiKoodi = () => String(crypto.randomInt(100000, 1000000));

const normalisoiEmail = (e) => String(e || '').trim().toLowerCase();
const kelpoEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

async function lahetaEmail(template, parametrit) {
    const avain = process.env.EMAILJS_PRIVATE_KEY;
    if (!avain) throw new Error('EMAILJS_PRIVATE_KEY puuttuu');
    const vastaus = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            service_id: EMAILJS_SERVICE, template_id: template,
            user_id: EMAILJS_PUBLIC_KEY, accessToken: avain, template_params: parametrit,
        }),
    });
    if (!vastaus.ok) throw new Error(`EmailJS ${vastaus.status}: ${await vastaus.text()}`);
}

// Firebase Realtime Database REST palvelutilin OAuth-tunnuksella (ei riippuvuuksia).
let tunnusMuisti = null;   // { tunnus, vanhenee } – säilyy saman funktio-instanssin kutsujen välillä

async function firebaseTunnus() {
    if (tunnusMuisti && tunnusMuisti.vanhenee > Date.now()) return tunnusMuisti.tunnus;
    const tili = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || 'null');
    if (!tili) throw new Error('FIREBASE_SERVICE_ACCOUNT puuttuu');
    const nyt = Math.floor(Date.now() / 1000);
    const otsake = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const vaitteet = b64url(JSON.stringify({
        iss: tili.client_email, aud: 'https://oauth2.googleapis.com/token', iat: nyt, exp: nyt + 3600,
        scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    }));
    const allekirjoitus = crypto.createSign('RSA-SHA256').update(`${otsake}.${vaitteet}`).sign(tili.private_key);
    const vastaus = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${otsake}.${vaitteet}.${b64url(allekirjoitus)}`,
        }),
    });
    if (!vastaus.ok) throw new Error(`Google OAuth ${vastaus.status}`);
    const tunnus = (await vastaus.json()).access_token;
    tunnusMuisti = { tunnus, vanhenee: Date.now() + 50 * 60 * 1000 };
    return tunnus;
}

async function firebase(metodi, polku, data) {
    const vastaus = await fetch(`${DATABASE_URL}/${polku}.json`, {
        method: metodi,
        headers: { Authorization: `Bearer ${await firebaseTunnus()}`, 'Content-Type': 'application/json' },
        body: data === undefined ? undefined : JSON.stringify(data),
    });
    if (!vastaus.ok) throw new Error(`Firebase ${vastaus.status}: ${await vastaus.text()}`);
    return vastaus.json();
}

const firebaseLisaa = (polku, data) => firebase('POST', polku, data);

// Pyyntörajat: Firebaseen tallennetaan avaimen (sähköpostin tai IP:n avaimellinen tiiviste, ei
// itse osoitetta) viimeisen tunnin pyyntöjen aikaleimat. Palauttaa false, jos raja on täynnä.
const RAJA_IKKUNA_MS = 60 * 60 * 1000;

async function mahtuuRajaan(laji, arvo, max) {
    const avain = crypto.createHmac('sha256', salaisuus()).update(`${laji}:${arvo}`).digest('hex').slice(0, 32);
    const polku = `Rajoitukset/${laji}/${avain}`;
    const nyt = Date.now();
    const aiemmat = ((await firebase('GET', polku)) || []).filter((t) => t > nyt - RAJA_IKKUNA_MS);
    if (aiemmat.length >= max) return false;
    await firebase('PUT', polku, [...aiemmat, nyt]);
    return true;
}

function asiakkaanIp(req) {
    const valitetty = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return valitetty || req.socket?.remoteAddress || 'tuntematon';
}

function vastaa(res, tila, data) {
    res.statusCode = tila;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
}

// Käsittelijän kääre: vain POST, JSON-runko, virheet lokiin eikä yksityiskohtia käyttäjälle.
const kasittelija = (fn) => async (req, res) => {
    if (req.method !== 'POST') return vastaa(res, 405, { virhe: 'Vain POST' });
    try {
        const runko = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        await fn(runko, res, req);
    } catch (e) {
        console.error(e);
        vastaa(res, 500, { virhe: 'Palvelinvirhe, yritä hetken päästä uudelleen' });
    }
};

module.exports = {
    KOODI_TEMPLATE, VAHVISTUS_TEMPLATE, allekirjoita, tarkista, koodinTiiviste, samaKoodi, uusiKoodi,
    normalisoiEmail, kelpoEmail, lahetaEmail, firebaseLisaa, mahtuuRajaan, asiakkaanIp, vastaa, kasittelija,
};
