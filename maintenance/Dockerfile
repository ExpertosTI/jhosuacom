FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html  /usr/share/nginx/html/index.html
COPY logo.png    /usr/share/nginx/html/logo.png
COPY renace.svg  /usr/share/nginx/html/renace.svg

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
