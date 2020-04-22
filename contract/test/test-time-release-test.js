// eslint-disable-next-line import/no-extraneous-dependencies
import { test } from 'tape-promise/tape';
// eslint-disable-next-line import/no-extraneous-dependencies
import bundleSource from '@agoric/bundle-source';
import harden from '@agoric/harden';
import produceIssuer from '@agoric/ertp';
import { E } from '@agoric/eventual-send';

import { makeZoe } from '@agoric/zoe';

const operaConcertTicketRoot = `${__dirname}/../src/contracts/time-release-test.js`;

test(`Time release contract`, async t => {
  // Setup initial conditions
  const zoe = makeZoe({ require });
  const inviteIssuer = zoe.getInviteIssuer();
 
  const contractReadyP = bundleSource(operaConcertTicketRoot).then(
    ({ source, moduleFormat }) => {
      const installationHandle = zoe.install(source, moduleFormat);

      return zoe
        .makeInstance(installationHandle)
        .then(myInvite => {
          return inviteIssuer
            .getAmountOf(myInvite)
            .then(({ extent: [{ instanceHandle: auditoriumHandle }] }) => {
              const { publicAPI } = zoe.getInstanceRecord(auditoriumHandle);

              return (
                zoe
                  .offer(myInvite, harden({}))
                  // cancel will be renamed complete: https://github.com/Agoric/agoric-sdk/issues/835
                  // cancelObj exists because of a current limitation in @agoric/marshal : https://github.com/Agoric/agoric-sdk/issues/818
                  .then(
                    async ({
                      outcome: outcomeP,
                      payout,
                      cancelObj: { cancel: complete },
                      offerHandle,
                    }) => {
                      const amount = await E(publicAPI.issuer).getAmountOf((await payout).Wrapper);
                      let timeLock1 = amount.extent[0].timeLock1;
                      let timeLock2 = amount.extent[0].timeLock2;
                      let payment1 = timeLock1.getPayment();
                      let payment2 = timeLock2.getPayment();

                      t.notEqual(payment1, null, `Payment 1 is not null`);
                      t.notEqual(payment1.getAllegedBrand, null, `It is really a payment.`)
                      t.equal(payment2, null, `Payment 1 is null`); // will be false after 10 years

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
  )
  .catch(err => {
    console.error('Error in last Opera part', err);
    t.fail('  error');
  })
  .then(() => t.end());
});