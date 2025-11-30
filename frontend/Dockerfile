FROM nginx:alpine

# Copying index.html file.
COPY index.html /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Expose its port
EXPOSE 80

# Start Nginx in foreground (default command
CMD [ "nginx", "-g", "daemon off;" ]
