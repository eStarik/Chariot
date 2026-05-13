import * as k8s from '@kubernetes/client-node';

async function test() {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
  
  try {
    const res = await customObjectsApi.getNamespacedCustomObject({
      group: 'agones.dev',
      version: 'v1',
      namespace: 'chariot-hoplites',
      plural: 'gameservers',
      name: 'mc-java-1211'
    }) as any;
    
    console.log('Keys of response:', Object.keys(res));
    if (res.body) console.log('Keys of res.body:', Object.keys(res.body));
    console.log('UID:', (res.body || res).metadata?.uid);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
