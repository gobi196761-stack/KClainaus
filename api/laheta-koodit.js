// Lähettää kummallekin osapuolelle oman vahvistuskoodin. Koodit eivät koskaan päädy selaimeen:
// vastauksena tulee vain allekirjoitettu haaste, jossa on koodien avaimelliset tiivisteet.
const kc = require('./_kc');

const VOIMASSA_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 3;    // koodipyyntöä samaan osoitteeseen tunnissa
const MAX_PER_IP = 10;      // koodipyyntöä samasta IP-osoitteesta tunnissa
const RAJA_TAYNNA = 'Liian monta koodipyyntöä. Yritä uudelleen tunnin kuluttua.';

module.exports = kc.kasittelija(async (runko, res, req) => {
    const isanta = kc.normalisoiEmail(runko.isantaEmail);
    const vieras = kc.normalisoiEmail(runko.vierasEmail);
    if (!kc.kelpoEmail(isanta) || !kc.kelpoEmail(vieras)) {
        return kc.vastaa(res, 400, { virhe: 'Tarkista sähköpostiosoitteet' });
    }
    if (isanta === vieras) return kc.vastaa(res, 400, { virhe: 'Osapuolilla pitää olla eri sähköpostit' });

    if (!(await kc.mahtuuRajaan('ip', kc.asiakkaanIp(req), MAX_PER_IP))) {
        return kc.vastaa(res, 429, { virhe: RAJA_TAYNNA });
    }
    for (const email of [isanta, vieras]) {
        if (!(await kc.mahtuuRajaan('email', email, MAX_PER_EMAIL))) return kc.vastaa(res, 429, { virhe: RAJA_TAYNNA });
    }

    const koodi1 = kc.uusiKoodi(), koodi2 = kc.uusiKoodi();
    await Promise.all([
        kc.lahetaEmail(kc.KOODI_TEMPLATE, { to_email: isanta, koodi: koodi1 }),
        kc.lahetaEmail(kc.KOODI_TEMPLATE, { to_email: vieras, koodi: koodi2 }),
    ]);
    const haaste = kc.allekirjoita({
        tyyppi: 'haaste', isantaEmail: isanta, vierasEmail: vieras,
        t1: kc.koodinTiiviste(koodi1, isanta), t2: kc.koodinTiiviste(koodi2, vieras),
        exp: Date.now() + VOIMASSA_MS,
    });
    kc.vastaa(res, 200, { haaste });
});
