import { createServer, Server as HTTPServer } from 'http';
import app from './app';
import { initiateSuperAdmin } from './app/DB';
import config from './config';
const port = config.port;

async function main() {
  const server: HTTPServer = createServer(app).listen(port, async () => {
    console.log('🚀 Server is running on port', port);
    await initiateSuperAdmin();
    // await seedSubscription();
  });



  const exitHandler = () => {
    if (server) {
      server.close(() => {
        console.info('Server closed!');
      });
    }
    process.exit(1);
  };

  process.on('uncaughtException', error => {
    console.log(error);
    exitHandler();
  });

  process.on('unhandledRejection', error => {
    console.log(error);
    exitHandler();
  });
}

main();
