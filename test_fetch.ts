
async function testProxy() {
  const url = 'https://cdn.myanimelist.net/images/anime/1546/141065.jpg';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Fetch failed with status: ${response.status} ${response.statusText}`);
    } else {
      console.log('Fetch successful');
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
testProxy();
