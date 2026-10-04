import Head from 'expo-router/head';

/** Sets the browser tab title, e.g. "My collection · Fandex". */
export function PageTitle({ title }: { title: string }) {
  return (
    <Head>
      <title>{`${title} · Fandex`}</title>
    </Head>
  );
}
