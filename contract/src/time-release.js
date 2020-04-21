class _BaseTimeRelease {
    constructor(payment, lockedUntil = Date.now()) {
        let _payment = payment;
        let _lockedUntil = lockedUntil;
        this.lockedUntil = function() {
            return _lockedUntil;
        }
        this.getPayment = function() {
            return this.currentTime() >= _lockedUntil ? _payment : null;
        }    
    }
    currentTime() { }
}

_BaseTimeRelease = harden(_BaseTimeRelease);


class _TimeRelease extends _BaseTimeRelease {
    currentTime() {
        return Date.now();
    }
}

class _TestTimeRelease extends _BaseTimeRelease {
    setCurrentTime(time) {
        this._currentTime = time;
    }
    currentTime() {
        return this._currentTime;
    }
}

_TimeRelease = harden(_TimeRelease);
_TestTimeRelease = harden(_TestTimeRelease);

export function makeTimeRelease(payment, lockedUntil = Date.now()) {
    return harden(new _TimeRelease(payment, lockedUntil));
}

export function makeTestTimeRelease(payment, lockedUntil = Date.now()) {
    return harden(new _TestTimeRelease(payment, lockedUntil));
}