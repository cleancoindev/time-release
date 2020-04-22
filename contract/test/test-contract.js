// eslint-disable-next-line import/no-extraneous-dependencies
import { test } from 'tape-promise/tape';
// eslint-disable-next-line import/no-extraneous-dependencies
import bundleSource from '@agoric/bundle-source';
import harden from '@agoric/harden';
import produceIssuer from '@agoric/ertp';
import { E } from '@agoric/eventual-send';

import { makeZoe } from '@agoric/zoe';

const operaConcertTicketRoot = `${__dirname}/../src/contracts/operaConcertTicket.js`;

test(`Zoe opera ticket contract`, async t => {
  // Setup initial conditions
  const {
    mint: moolaMint,
    issuer: moolaIssuer,
    amountMath: { make: moola },
  } = produceIssuer('moola');

  const zoe = makeZoe({ require });
  const inviteIssuer = zoe.getInviteIssuer();

  // === Initial Opera de Bordeaux part ===
  const contractReadyP = bundleSource(operaConcertTicketRoot).then(
    ({ source, moduleFormat }) => {
      const expectedAmountPerTicket = moola(22);

      const installationHandle = zoe.install(source, moduleFormat);

      return zoe
        .makeInstance(installationHandle, harden({ Money: moolaIssuer }), {
          show: 'Steven Universe, the Opera',
          start: 'Web, March 25th 2020 at 8pm',
          count: 3,
          expectedAmountPerTicket,
        })
        .then(auditoriumInvite => {
          return inviteIssuer
            .getAmountOf(auditoriumInvite)
            .then(({ extent: [{ instanceHandle: auditoriumHandle }] }) => {
              const { publicAPI } = zoe.getInstanceRecord(auditoriumHandle);

              // The auditorium makes an offer.
              return (
                // Note that the proposal here is empty
                // This is due to a current limitation in proposal expressivness: https://github.com/Agoric/agoric-sdk/issues/855
                // It's impossible to know in advance how many tickets will be sold, so it's not possible
                // to say `want: moola(3*22)`
                // in a future version of Zoe, it will be possible to express:
                // "i want n times moolas where n is the number of sold tickets"
                zoe
                  .offer(auditoriumInvite, harden({}))
                  // cancel will be renamed complete: https://github.com/Agoric/agoric-sdk/issues/835
                  // cancelObj exists because of a current limitation in @agoric/marshal : https://github.com/Agoric/agoric-sdk/issues/818
                  .then(
                    async ({
                      outcome: auditoriumOutcomeP,
                      payout,
                      cancelObj: { cancel: complete },
                      offerHandle,
                    }) => {
                      const { currentAllocation } = await E(zoe).getOffer(
                        await offerHandle,
                      );

                      return {
                        publicAPI,
                        operaPayout: payout,
                        complete,
                      };
                    },
                  )
              );
            });
        });
    },
  );

  const alicePartFinished = contractReadyP.then(({ publicAPI }) => {
    const ticketIssuer = publicAPI.getTicketIssuer();
    const ticketAmountMath = ticketIssuer.getAmountMath();

    // === Alice part ===
    // Alice starts with 100 moolas
    const alicePurse = moolaIssuer.makeEmptyPurse();
    alicePurse.deposit(moolaMint.mintPayment(moola(100)));

    // Alice makes an invite
    const aliceInvite = inviteIssuer.claim(publicAPI.makeBuyerInvite());
    return inviteIssuer
      .getAmountOf(aliceInvite)
      .then(({ extent: [{ instanceHandle: aliceHandle }] }) => {
        const { terms: termsOfAlice } = zoe.getInstanceRecord(aliceHandle);
      });
  });

  return Promise.all([contractReadyP])
    .then(([{ publicAPI, operaPayout, complete }]) => {
      // === Final Opera part ===
      // getting the money back
      const availableTickets = publicAPI.getAvailableTickets();

      const operaPurse = moolaIssuer.makeEmptyPurse();

      const done = operaPayout.then(payout => {
        return payout.Money.then(moneyPayment => {
          return operaPurse.deposit(moneyPayment);
        }).then(() => {
        });
      });

      complete();

      return done;
    })
    .catch(err => {
      console.error('Error in last Opera part', err);
      t.fail('error');
    })
    .then(() => t.end());
});