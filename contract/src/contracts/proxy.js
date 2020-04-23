/* eslint-disable no-use-before-define */
import harden from '@agoric/harden';
import produceIssuer from '@agoric/ertp';

import { makeTimeRelease } from './time-release';

// zcf is the Zoe Contract Facet, i.e. the contract-facing API of Zoe
/**
 * @type {import('@agoric/zoe').MakeContract}
 */
export const makeContract = harden(zcf => {
  const { terms: { timerService } = {} } = zcf.getInstanceRecord();

  // Create the internal token mint
  const { issuer, mint, amountMath } = produceIssuer(
    'Futures',
    'set',
  );
  const wrapperToken = amountMath.make;

  let payments = new Map(); // from handle ({}) to payment

  return zcf.addNewIssuer(issuer, 'Wrapper').then(() => {
    const adminHook = userOfferHandle => {
    }

    // the contract creates an offer {give: wrapper, want: nothing} with the time release wrapper
    const sendHook = (lockedPayment, handle, date) => userOfferHandle => {
      const offer = zcf.getOffer(userOfferHandle);
      const lock = makeTimeRelease(zcf, timerService, lockedPayment, );

      const wrapperAmount = wrapperToken(harden([harden(lock)]));
      const wrapperPayment = mint.mintPayment(wrapperAmount);

      let tempContractHandle;
      const contractSelfInvite = zcf.makeInvitation(
        offerHandle => (tempContractHandle = offerHandle),
      );

      payments.set(handle, wrapperPayment);

      zcf
        .getZoeService()
        .offer(
          contractSelfInvite,
          harden({ give: { Wrapper: wrapperAmount, handle: handle } }),
          harden({ Wrapper: wrapperPayment }),
        ).then(() => {
          // Don't forget to call this, otherwise the other side won't be able to get the money:
          lock.setOffer(tempContractHandle);

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

    const receiveHook = handle => userOfferHandle => {
      const offer = zcf.getOffer(userOfferHandle);
      const wrapperPayment = payments.get(handle);

      zcf
        .getZoeService()
        .offer(
          contractSelfInvite,
          harden({ give: { Wrapper: wrapperPayment } }),
          harden({ Wrapper: wrapperPayment }),
        ).then(() => {
          zcf.reallocate(
            [tempContractHandle, userOfferHandle],
            [
              zcf.getCurrentAllocation(userOfferHandle),
              zcf.getCurrentAllocation(tempContractHandle),
            ],
          );
          zcf.complete([tempContractHandle, userOfferHandle]); // FIXME: enough just one of them?
          payments.delete(handle); // We already delivered it.
          return `Scheduled payment delivered.`;
        });
    }
    
    const makeSendInvite = (payment, handler, date) => () =>
      inviteAnOffer(
        harden({
          sendHook: sendHook(payment, handler, date),
          customProperties: { inviteDesc: 'offer' },
        }),
      );

    const makeReceiveInvite = () =>
      inviteAnOffer(
        harden({
          receiveHook: receiveHook,
          customProperties: { inviteDesc: 'get money' },
        }),
      );

    return harden({
      invite: zcf.makeInvitation(adminHook),
      publicAPI: {
        makeSendInvite,
        makeReceiveInvite,
        //currency: wrapperToken,
        issuer: issuer,
      },
    });
  });
});
