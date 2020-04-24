import { E } from '@agoric/eventual-send';

class _TimeRelease {
    constructor(zcf, timerService, payment, lockedUntil) {
        let _payment = payment;
        let _lockedUntil = lockedUntil;
        this.lockedUntil = function() {
            return _lockedUntil;
        }
        this.getPayment = async function() {
            // if(!_offer) return;
            // const zoe = zcf.getZoeService();
            // console.log(await E(timerService).getCurrentTimestamp(), _lockedUntil)
            return /*zoe.isOfferActive(_offer) &&*/ await E(timerService).getCurrentTimestamp() >= _lockedUntil ? _payment : null;
        }
        // this.setOffer = function(offer) {
        //     _offer = offer;
        // }
    }
}

_TimeRelease = harden(_TimeRelease);

export function makeTimeRelease(zcf, timerService, payment, lockedUntil) {
    return harden(new _TimeRelease(zcf, timerService, payment, lockedUntil));
}
