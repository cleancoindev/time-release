/* eslint-disable no-use-before-define */
import harden from '@agoric/harden';
import produceIssuer from '@agoric/ertp';
import { makeZoeHelpers } from '@agoric/zoe/src/contractSupport';

import { makeTimeRelease } from './time-release';
import { cleanProposal } from '@agoric/zoe/src/cleanProposal';


// zcf is the Zoe Contract Facet, i.e. the contract-facing API of Zoe
/**
 * @type {import('@agoric/zoe').MakeContract}
 */
export const makeContract = harden(zcf => {
  const { terms: { timerService } = {} } = zcf.getInstanceRecord();

  // Create the internal token mint
  const { issuer, mint, amountMath } = produceIssuer(
    'Wrapper',
    'set',
  );
  const wrapperToken = amountMath.make;

  //let payments = new Map(); // from handle ({}) to payment

  let nonce = 0;

  return zcf.addNewIssuer(issuer, 'Wrapper').then(() => {
    const adminHook = userOfferHandle => {
    }

    // the contract creates an offer {give: wrapper, want: nothing} with the time release wrapper
    const sendHook = (receiver, paymentIssuer, lockedPayment, date) => async userOfferHandle => {
      const lock = makeTimeRelease(zcf, timerService, paymentIssuer, lockedPayment, date);

      const wrapperAmount = wrapperToken(harden([[harden(lock), ++nonce]]));
      const wrapperPayment = mint.mintPayment(wrapperAmount);

      zcf.reallocate(
        [userOfferHandle],
        [zcf.getCurrentAllocation(userOfferHandle)],
        );
      zcf.complete([userOfferHandle]);
      return await receiver.receivePayment(wrapperPayment); // wait until it is received
    }

    const { inviteAnOffer } = makeZoeHelpers(zcf);   
    
    const makeSendInvite = (receiver, paymentIssuer, payment, date) => () =>
      inviteAnOffer(
        harden({
          offerHook: sendHook(receiver, paymentIssuer, payment, date),
          customProperties: { inviteDesc: 'offer' },
        }),
      );

    return harden({
      invite: zcf.makeInvitation(adminHook),
      publicAPI: {
        makeSendInvite,
        // makeReceiveInvite,
        //currency: wrapperToken,
        issuer: issuer,
      },
    });
  });
});
