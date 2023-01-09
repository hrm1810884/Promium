#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main()
{
    int c = 10000000;
    int *p = (int *)malloc(sizeof(int) * c);
    sleep(100);
}