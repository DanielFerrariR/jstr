import { Cookie, CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import axios, { AxiosInstance } from 'axios';
import { ConnectOptions, LoginPayload, VerifySmsPinPayload } from '../types';
import {
  CONNECTION_MESSAGE,
  CONNECTION_STATUS,
  SUBSCRIPTION_TYPES,
  TRADE_REPUBLIC_API_URL,
  TRADE_REPUBLIC_WEBSOCKET_URL,
} from '../constants';
import WebSocket from 'ws';

export class TradeRepublicAPI {
  private static instance: TradeRepublicAPI;
  private _cookieJar: CookieJar;
  private _client: AxiosInstance;
  private _webSocket: WebSocket | undefined;
  private _sessionToken: string | undefined;
  private _subscriptionId = 1;
  private _subscriptions: { [key: number]: any } = {};

  private constructor() {
    this._cookieJar = new CookieJar();
    this._client = axios.create({
      baseURL: TRADE_REPUBLIC_API_URL,
      withCredentials: true,
    });
    wrapper(this._client);
    this._client.defaults.jar = this._cookieJar;
  }

  public static getInstance(): TradeRepublicAPI {
    if (!TradeRepublicAPI.instance) {
      TradeRepublicAPI.instance = new TradeRepublicAPI();
    }
    return TradeRepublicAPI.instance;
  }

  public static isApiError(error: unknown) {
    return axios.isAxiosError(error);
  }

  public login({ phoneNumber, pin }: LoginPayload) {
    return this._client.post('/api/v1/auth/web/login', {
      phoneNumber,
      pin,
    });
  }

  public async verifySmsPin({ processId, smsPin }: VerifySmsPinPayload) {
    await this._client.post(`/api/v1/auth/web/login/${processId}/${smsPin}`);
    // Get the session token from cookies after login
    const cookies: Cookie[] = await this._cookieJar.getCookies(
      TRADE_REPUBLIC_API_URL,
    );
    this._sessionToken = cookies.find(
      (cookie) => cookie.key === 'tr_session',
    )?.value;
  }

  public _sendSubscriptionMessage(
    type: SUBSCRIPTION_TYPES,
    after?: string,
    transactionId?: string,
  ) {
    if (!this._webSocket) {
      console.warn('WebSocket is not connected.');
      return;
    }

    const jsonPayload = {
      type,
      token: this._sessionToken,
      ...(after ? { after } : {}),
      ...(transactionId ? { id: transactionId } : {}),
    };

    this._webSocket.send(
      `sub ${this._subscriptionId} ${JSON.stringify(jsonPayload)}`,
    );
    this._subscriptions[this._subscriptionId] = jsonPayload;
    this._subscriptionId++;
  }

  public sendTransactionsMessage(after?: string) {
    this._sendSubscriptionMessage(SUBSCRIPTION_TYPES.TRANSACTIONS, after);
  }

  public sendActivitiesMessage(after?: string) {
    this._sendSubscriptionMessage(SUBSCRIPTION_TYPES.ACTIVITIES, after);
  }

  public sendTransactionDetailsMessage(transactionId: string) {
    this._sendSubscriptionMessage(
      SUBSCRIPTION_TYPES.TRANSACTION_DETAILS,
      undefined,
      transactionId,
    );
  }

  public connect({
    onOpen,
    onClose,
    onConnected,
    onMessage,
    onError,
  }: ConnectOptions = {}) {
    this._webSocket = new WebSocket(TRADE_REPUBLIC_WEBSOCKET_URL);

    this._webSocket.onopen = async () => {
      this._webSocket!.send(CONNECTION_MESSAGE);
      onOpen?.();
    };

    this._webSocket.onmessage = (event) => {
      const message = event.data.toString();

      if (message === 'connected') {
        onConnected?.(message);
        return;
      }

      let jsonPayload: any;

      const [subscriptionId, command] = message.split(' ', 2);
      let jsonMatch = message.match(/\{.*\}/s);

      try {
        // jsonMatch might be undefined if command is keep-alive
        if (jsonMatch) jsonPayload = JSON.parse(jsonMatch[0]);
      } catch (error) {
        console.warn('Failed to parse JSON payload:', error);
      }

      onMessage?.(message, {
        command,
        jsonPayload,
        subscription: this._subscriptions[Number(subscriptionId)],
      });
    };

    this._webSocket.onclose = (event) => {
      onClose?.(event);
    };

    this._webSocket.onerror = (event) => {
      onError?.(event);
    };

    this;
  }

  public sendMessage(message: string) {
    if (!this._webSocket) {
      console.warn('WebSocket is not connected.');
      return;
    }

    // To always include the token if the message has a format like: sub 1 {"type":"availableCash"}
    try {
      const [command, subscriptionId] = message.split(' ', 2);
      let jsonMatch = message.match(/\{.*\}/s);
      if (!jsonMatch) throw new Error('No JSON payload found in message');
      const jsonPayload = JSON.parse(jsonMatch![0]);
      jsonPayload.token = this._sessionToken;
      message = `${command} ${subscriptionId} ${JSON.stringify(jsonPayload)}`;
    } catch (error) {
      console.warn(
        "Could not parse subscription message for token injection. Ensure it's valid JSON.",
        error,
      );
    }

    console.log('Sending message:', message);
    this._webSocket?.send(message);
  }

  public disconnect() {
    if (!this._webSocket) {
      console.warn('WebSocket is not connected.');
      return;
    }

    this._webSocket.close();
    this._webSocket = undefined;
  }

  public getConnectionStatus() {
    if (!this._webSocket) {
      console.warn('WebSocket is not connected.');
      return;
    }

    let status = CONNECTION_STATUS.UNKNOWN;
    Object.values(CONNECTION_STATUS).forEach((value) => {
      if (this._webSocket!.readyState === value) {
        status = value;
      }
    });
    return status;
  }
}
