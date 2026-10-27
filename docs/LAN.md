# Phone / LAN access

Default launch remains local-only. To opt into private IPv4 LAN access:

- Windows: double-click `Start-Orbit-LAN.cmd`, or run `./Start-Orbit.ps1 -Lan`.
- CLI: `npm start -- --lan` (run `npm run build` first).
- The launcher prints `Phone (same network): http://<computer-ip>:4173`.
- Keep the computer awake and connected. IP changes require restarting the service.
- If a local-only instance is running, stop that instance first. The launcher does not kill unrelated processes or silently restart a service.

The frontend renders on the phone; it is not desktop screen streaming or synchronized playback. Desktop files are not remotely browsable; imported files come from the phone's file picker.

## Campus networks / 校园网

手机连接校园 Wi-Fi 后，用浏览器打开启动器打印的电脑地址，使用 **http** 而不是 https。
电脑有线连接与手机 Wi-Fi 不一定互通；同名 Wi-Fi 也可能有 AP 隔离、不同 VLAN 或校园网访问控制。
如果一直超时，先检查火绒/系统防火墙是否阻止 Node.js TCP 4173 入站；只为需要的局域网来源放行，不要关闭防火墙。
如果网络本身隔离设备，可改为电脑和手机连接同一个个人热点后重启 ORBIT。无须公网域名、路由器端口映射或修改博客。

## Boundaries

LAN mode binds IPv4 `0.0.0.0`, but allows only loopback/local private IPv4 Host values and private IPv4 clients. It does not enable public IPv6 access. Host allowlisting and same-origin API checks remain enabled; no wildcard CORS is added.
This is NOT authentication: other reachable campus/private-network devices may access the app and trigger downloads. Run it only while needed, restrict inbound sources with the firewall when necessary, and do not forward this port to the Internet.
Old-map checksum validation uses a browser-compatible SHA-256 implementation so it also works on non-secure HTTP LAN origins. Clipboard and fullscreen capabilities still depend on the phone browser; manual URL copying remains available.
Desktop-side HTTP checks do not prove campus Wi-Fi routing or actual phone/browser playback. Those require testing from the phone.
