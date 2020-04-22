/* eslint-disable no-use-before-define */
import harden from '@agoric/harden';
import produceIssuer from '@agoric/ertp';

import { makeTimeRelease } from './time-release';

// zcf is the Zoe Contract Facet, i.e. the contract-facing API of Zoe
export const makeContract = harden(zcf => {
  // Create the internal token mint
  const { issuer: paymentIssuer, mint: paymentMint, amountMath: paymentAmountMath } = produceIssuer('BaytownBucks');
  const { issuer, mint, amountMath } = produceIssuer(
    'Futures',
    'set',
  );
  const baytownBucks = paymentAmountMath.make;
  const wrapperToken = amountMath.make;

//   const {
//     terms: { timeLock },
//   } = zcf.getInstanceRecord();

  return zcf.addNewIssuer(issuer, 'Token').then(() => {
    // Mint the tickets ahead-of-time (instead of on-demand)
    // This way, they can be passed to Zoe + ERTP who will be doing the bookkeeping
    // of which tickets have been sold and which tickets are still for sale
    // const ticketsPayment = baytownBucksMint.mintPayment(ticketsAmount);

    // the contract creates an offer {give: tickets, want: nothing} with the tickets
    const offerHook = userOfferHandle => {
      const lockedPayment = paymentMint.mintPayment(baytownBucks(1000));
      let date = new Date();
      let date2 = new Date(date);
      date2.setFullYear(date2.getFullYear() + 10); // I hope we won't stay 10 years paused
      const lock = makeTimeRelease(lockedPayment, date2);

      const ticketsAmount = wrapperToken(harden([harden({timeLock: lock})]));
      const ticketsPayment = mint.mintPayment(ticketsAmount);
      let tempContractHandle;
      const contractSelfInvite = zcf.makeInvitation(
        offerHandle => (tempContractHandle = offerHandle),
      );
      zcf
        .getZoeService()
        .offer(
          contractSelfInvite,
          harden({ give: { Token: ticketsAmount } }),
          harden({ Token: ticketsPayment }),
        ).then(() => {
          zcf.reallocate(
            [tempContractHandle, userOfferHandle],
            [
              zcf.getCurrentAllocation(userOfferHandle),
              zcf.getCurrentAllocation(tempContractHandle),
            ],
          );
          zcf.complete([tempContractHandle, userOfferHandle]); // FIXME: enough just one of them?
          return `Payment scheduled.`;
        });
    }
    return harden({
      invite: zcf.makeInvitation(offerHook),
      publicAPI: {
        //invite2: zcf.makeInvitation(offerHook),
        currency: wrapperToken,
        issuer: issuer,
      },
    });
  });
});
